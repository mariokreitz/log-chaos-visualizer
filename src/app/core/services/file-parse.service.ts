import { inject, Injectable, signal } from '@angular/core';
import type { ParsingSpeed } from '../../shared/config/settings-config.types';
import { APP_CONFIG } from '../config/app-config';
import type {
  EnvironmentSummary,
  ErrorFatalTimelineBucket,
  ErrorFatalTimelineSummary,
  ExtendedParseSummary,
  LevelSummary,
  NormalizedEnvironment,
  NormalizedLogLevel,
  ParsedBatch,
  ParsedLogEntry,
  ParseProgress,
  WorkerMessage,
  WorkerStartMessage,
} from '../types/file-parse.types';
import { NotificationService } from './notification.service';
import { SettingsService } from './settings.service';

// Removed unused type ParsedLogEntryWithSearch

const DEFAULT_TIMELINE_BUCKET_MS = 60_000; // 1 minute
const DEFAULT_TOP_N_PEAKS = 5;

@Injectable({ providedIn: 'root' })
export class FileParseService {
  readonly selectedFile = signal<File | null>(null);
  readonly progress = signal<ParseProgress | null>(null);
  readonly summary = signal<ExtendedParseSummary | null>(null);
  readonly error = signal<string | null>(null);
  readonly isParsing = signal(false);
  readonly latestBatch = signal<ParsedBatch | null>(null);
  readonly allEntries = signal<ParsedLogEntry[]>([]);

  private worker: Worker | null = null;
  private readonly notifications = inject(NotificationService);
  private readonly settings = inject(SettingsService);

  private readonly searchCache = new Map<string, ParsedLogEntry[]>();

  setFile(file: File | null): void {
    this.reset();
    this.searchCache.clear();
    if (file) {
      this.selectedFile.set(file);
    }
  }

  startParse(): void {
    const file = this.selectedFile();
    if (!file) {
      this.error.set('No file selected.');
      this.notifications.error('No file selected for parsing.');
      return;
    }
    this.searchCache.clear();
    this.error.set(null);
    this.isParsing.set(true);
    this.progress.set({ processedBytes: 0, totalBytes: file.size, percent: 0 });

    const emptyLevelSummary: LevelSummary = {
      total: 0,
      byLevel: {
        trace: 0,
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
        unknown: 0,
      },
    };

    const emptyEnvironmentSummary: EnvironmentSummary = {
      total: 0,
      byEnvironment: {
        dev: 0,
        staging: 0,
        prod: 0,
        unknown: 0,
      },
    };

    const emptyTimeline: ErrorFatalTimelineSummary = {
      bucketSizeMs: DEFAULT_TIMELINE_BUCKET_MS,
      buckets: [],
      topPeakBucketIndices: [],
      totalErrorCount: 0,
      totalFatalCount: 0,
      noTimestampErrorCount: 0,
      noTimestampFatalCount: 0,
    };

    this.summary.set({
      totalLines: 0,
      malformedCount: 0,
      counts: {
        pino: 0,
        winston: 0,
        loki: 0,
        promtail: 0,
        docker: 0,
        'unknown-json': 0,
        text: 0,
      },
      levelSummary: emptyLevelSummary,
      environmentSummary: emptyEnvironmentSummary,
      errorFatalTimeline: emptyTimeline,
    });
    this.latestBatch.set(null);
    this.allEntries.set([]);

    const speed = this.settings.parsingSpeed();
    const { chunkSize, delayMs } = getParsingParameters(speed);

    this.worker?.terminate();
    this.worker = new Worker(new URL('../workers/parse-logs.worker', import.meta.url), { type: 'module' });

    this.worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as WorkerMessage;
      if (msg.type === 'progress') {
        this.progress.set(msg.progress);
      } else if (msg.type === 'batch') {
        this.latestBatch.set(msg.batch);
        // Append parsed entries to the global accumulator used by analysis UIs.
        if (msg.batch.entries && msg.batch.entries.length) {
          this.allEntries.update((prev) => prev.concat(msg.batch.entries));
          // If there is no active filter, keep filteredEntries in sync with allEntries
        }
        const current = this.summary();
        if (current) {
          const updated: ExtendedParseSummary = {
            totalLines: current.totalLines + msg.batch.rawCount,
            malformedCount: current.malformedCount + msg.batch.malformedCount,
            counts: { ...current.counts },
            levelSummary: {
              total: current.levelSummary.total,
              byLevel: { ...current.levelSummary.byLevel },
            },
            environmentSummary: {
              total: current.environmentSummary.total,
              byEnvironment: { ...current.environmentSummary.byEnvironment },
            },
            errorFatalTimeline: current.errorFatalTimeline
              ? { ...current.errorFatalTimeline, buckets: [...current.errorFatalTimeline.buckets] }
              : undefined,
          };

          for (const entry of msg.batch.entries) {
            updated.counts[entry.kind] = (updated.counts[entry.kind] ?? 0) + 1;

            const level = normalizeLogLevel(entry);
            updated.levelSummary.total += 1;
            updated.levelSummary.byLevel[level] = (updated.levelSummary.byLevel[level] ?? 0) + 1;

            const env = normalizeEnvironment(entry);
            updated.environmentSummary.total += 1;
            updated.environmentSummary.byEnvironment[env] = (updated.environmentSummary.byEnvironment[env] ?? 0) + 1;

            updated.errorFatalTimeline = updateErrorFatalTimeline(updated.errorFatalTimeline, entry, level);
          }

          if (updated.errorFatalTimeline) {
            updated.errorFatalTimeline.topPeakBucketIndices = computeTopPeaks(
              updated.errorFatalTimeline.buckets,
              DEFAULT_TOP_N_PEAKS,
            );
          }

          this.summary.set(updated);
        }
      } else if (msg.type === 'summary') {
        const current = this.summary();
        if (current) {
          this.summary.set({
            ...current,
            totalLines: msg.summary.totalLines,
            malformedCount: msg.summary.malformedCount,
            counts: msg.summary.counts,
          });
        } else {
          this.summary.set(msg.summary);
        }
      } else if (msg.type === 'done') {
        this.isParsing.set(false);
        this.notifications.success('Log file parsed successfully.');
        // Ensure filteredEntries is defined when parsing completes and no filter is applied
      } else if (msg.type === 'error') {
        this.error.set(msg.error);
        this.isParsing.set(false);
        this.notifications.error('Failed to parse log file.');
      }
    };

    const startMsg: WorkerStartMessage = {
      type: 'start',
      file,
      chunkSize,
      delayMs,
    };
    this.worker.postMessage(startMsg);
  }

  reset(): void {
    this.worker?.terminate();
    this.worker = null;
    this.searchCache.clear();
    this.progress.set(null);
    this.summary.set(null);
    this.error.set(null);
    this.isParsing.set(false);
    this.latestBatch.set(null);
    this.allEntries.set([]);
  }
}

export function getParsingParameters(speed: ParsingSpeed): { chunkSize: number; delayMs: number } {
  const presets = APP_CONFIG.parsing.presets;
  const fallback = presets[APP_CONFIG.parsing.defaultSpeed];
  return presets[speed] ?? fallback;
}

function normalizeLogLevel(entry: ParsedLogEntry): NormalizedLogLevel {
  if (entry.kind === 'pino') {
    const level = entry.entry.level;
    if (level === 10) return 'trace';
    if (level === 20) return 'debug';
    if (level === 30) return 'info';
    if (level === 40) return 'warn';
    if (level === 50) return 'error';
    if (level === 60) return 'fatal';
    return 'unknown';
  }

  if (entry.kind === 'winston') {
    const level = entry.entry.level;
    if (level === 'debug') return 'debug';
    if (level === 'info') return 'info';
    if (level === 'warn') return 'warn';
    if (level === 'error') return 'error';
    if (level === 'silly' || level === 'verbose') return 'trace';
    return 'unknown';
  }

  if (entry.kind === 'promtail') {
    const level = entry.entry.level;
    if (level === 'debug') return 'debug';
    if (level === 'info') return 'info';
    if (level === 'warn') return 'warn';
    if (level === 'error') return 'error';
    return 'unknown';
  }

  if (entry.kind === 'text') {
    const raw = entry.entry.line;
    if (!raw) {
      return 'unknown';
    }
    const firstToken = raw.split(/\s+/, 1)[0];
    switch (firstToken) {
      case 'TRACE':
        return 'trace';
      case 'DEBUG':
        return 'debug';
      case 'INFO':
        return 'info';
      case 'WARN':
        return 'warn';
      case 'ERROR':
        return 'error';
      default:
        return 'unknown';
    }
  }

  // Docker logs: derive level from stream (stderr -> error, stdout -> info)
  if (entry.kind === 'docker') {
    try {
      const dockerEntry = entry.entry as unknown as { stream?: string; log?: string };
      const stream = String(dockerEntry.stream ?? '').toLowerCase();
      if (stream === 'stderr') return 'error';
      if (stream === 'stdout') return 'info';
      // Fallback: attempt to extract level token from the log text
      const log = dockerEntry.log ?? '';
      const m = /level=(trace|debug|info|warn|error|fatal)\b/i.exec(String(log));
      if (m) return m[1].toLowerCase() as NormalizedLogLevel;
    } catch {
      // ignore
    }
    return 'unknown';
  }

  return 'unknown';
}

function normalizeEnvironment(entry: ParsedLogEntry): NormalizedEnvironment {
  if (entry.kind === 'loki') {
    const env = entry.entry.labels.environment;
    if (env === 'dev' || env === 'staging' || env === 'prod') {
      return env;
    }
    return 'unknown';
  }

  if (entry.kind === 'pino' && entry.entry.meta) {
    const env = (entry.entry.meta as Record<string, unknown>)['environment'];
    if (env === 'dev' || env === 'staging' || env === 'prod') {
      return env;
    }
  }

  if (entry.kind === 'winston' && entry.entry.meta) {
    const env = (entry.entry.meta as Record<string, unknown>)['environment'];
    if (env === 'dev' || env === 'staging' || env === 'prod') {
      return env;
    }
  }

  if (entry.kind === 'promtail') {
    const anyEntry = entry.entry as unknown as { environment?: string };
    const env = anyEntry.environment;
    if (env === 'dev' || env === 'staging' || env === 'prod') {
      return env;
    }
  }

  if (entry.kind === 'docker') {
    const log = entry.entry.log ?? '';
    const match = /env=(dev|staging|prod)\b/.exec(log);
    if (match) {
      return match[1] as NormalizedEnvironment;
    }
  }

  if (entry.kind === 'text') {
    const line = entry.entry.line ?? '';
    const match = /env=(dev|staging|prod)\b/.exec(line);
    if (match) {
      return match[1] as NormalizedEnvironment;
    }
  }

  return 'unknown';
}

function getEntryTimestampMs(entry: ParsedLogEntry): number | null {
  if (entry.kind === 'pino') {
    const time = entry.entry.time;
    return Number.isFinite(time) ? time : null;
  }

  if (entry.kind === 'winston') {
    const ts = entry.entry.timestamp;
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? null : ms;
  }

  if (entry.kind === 'loki') {
    const ts = entry.entry.ts;
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? null : ms;
  }

  if (entry.kind === 'promtail') {
    const ts = entry.entry.ts;
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? null : ms;
  }

  if (entry.kind === 'docker') {
    const ts = entry.entry.time;
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? null : ms;
  }

  return null;
}

function updateErrorFatalTimeline(
  summary: ErrorFatalTimelineSummary | undefined | null,
  entry: ParsedLogEntry,
  level: NormalizedLogLevel,
): ErrorFatalTimelineSummary {
  if (level !== 'error' && level !== 'fatal') {
    return (
      summary ?? {
        bucketSizeMs: DEFAULT_TIMELINE_BUCKET_MS,
        buckets: [],
        topPeakBucketIndices: [],
        totalErrorCount: 0,
        totalFatalCount: 0,
        noTimestampErrorCount: 0,
        noTimestampFatalCount: 0,
      }
    );
  }

  const base: ErrorFatalTimelineSummary = summary ?? {
    bucketSizeMs: DEFAULT_TIMELINE_BUCKET_MS,
    buckets: [],
    topPeakBucketIndices: [],
    totalErrorCount: 0,
    totalFatalCount: 0,
    noTimestampErrorCount: 0,
    noTimestampFatalCount: 0,
  };

  const timestampMs = getEntryTimestampMs(entry);
  if (timestampMs === null) {
    if (level === 'error') {
      return {
        ...base,
        noTimestampErrorCount: base.noTimestampErrorCount + 1,
      };
    }
    return {
      ...base,
      noTimestampFatalCount: base.noTimestampFatalCount + 1,
    };
  }

  const bucketSizeMs = base.bucketSizeMs;
  const bucketIndex = Math.floor(timestampMs / bucketSizeMs);
  const bucketStartMs = bucketIndex * bucketSizeMs;
  const bucketEndMs = bucketStartMs + bucketSizeMs;

  const buckets: ErrorFatalTimelineBucket[] = base.buckets.slice();
  const existingIndex = buckets.findIndex((b) => b.bucketStartMs === bucketStartMs);

  if (existingIndex === -1) {
    const errorCount = level === 'error' ? 1 : 0;
    const fatalCount = level === 'fatal' ? 1 : 0;
    buckets.push({
      bucketStartMs,
      bucketEndMs,
      errorCount,
      fatalCount,
      total: errorCount + fatalCount,
    });
  } else {
    const bucket = buckets[existingIndex];
    const errorCount = bucket.errorCount + (level === 'error' ? 1 : 0);
    const fatalCount = bucket.fatalCount + (level === 'fatal' ? 1 : 0);
    buckets[existingIndex] = {
      ...bucket,
      errorCount,
      fatalCount,
      total: errorCount + fatalCount,
    };
  }

  buckets.sort((a, b) => a.bucketStartMs - b.bucketStartMs);

  const totalErrorCount = buckets.reduce((acc, b) => acc + b.errorCount, base.noTimestampErrorCount);
  const totalFatalCount = buckets.reduce((acc, b) => acc + b.fatalCount, base.noTimestampFatalCount);

  return {
    ...base,
    buckets,
    totalErrorCount,
    totalFatalCount,
  };
}

function computeTopPeaks(buckets: ErrorFatalTimelineBucket[], topN: number): number[] {
  if (topN <= 0 || buckets.length === 0) {
    return [];
  }

  const indexed = buckets.map((bucket, index) => ({ index, total: bucket.total })).filter((item) => item.total > 0);

  indexed.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a.index - b.index;
  });

  return indexed.slice(0, topN).map((item) => item.index);
}
