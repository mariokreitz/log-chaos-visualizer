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
  WorkerSearchMessage,
  WorkerStartMessage,
} from '../types/file-parse.types';
import { NotificationService } from './notification.service';
import { SettingsService } from './settings.service';

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
  readonly filterQuery = signal<string>('');
  readonly filteredEntries = signal<ParsedLogEntry[] | null>(null);
  readonly isSearching = signal(false);
  readonly lastSearchDurationMs = signal<number | null>(null);
  readonly lastSearchResultCount = signal<number | null>(null);

  private lastSearchStartedAt: number | null = null;
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
    this.filterQuery.set('');
    this.filteredEntries.set(null);
    this.isSearching.set(false);
    this.lastSearchDurationMs.set(null);
    this.lastSearchResultCount.set(null);

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
          if (!this.filterQuery()) {
            this.filteredEntries.update((prev) => {
              const base = prev ?? [];
              return base.concat(msg.batch.entries);
            });
          }
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
        if (!this.filterQuery() && this.filteredEntries() === null) {
          this.filteredEntries.set(this.allEntries());
        }
      } else if (msg.type === 'error') {
        this.error.set(msg.error);
        this.isParsing.set(false);
        this.notifications.error('Failed to parse log file.');
      } else if (msg.type === 'search-start') {
        this.isSearching.set(true);
        this.lastSearchStartedAt = performance.now();
      } else if (msg.type === 'search-result') {
        // Only apply the result if it matches the current filter query
        if (msg.query === this.filterQuery().trim().toLowerCase()) {
          this.filteredEntries.set(msg.entries);
          if (this.lastSearchStartedAt !== null) {
            const duration = performance.now() - this.lastSearchStartedAt;
            this.lastSearchDurationMs.set(duration);
          }
          this.lastSearchResultCount.set(msg.entries.length);
          this.searchCache.set(msg.query, msg.entries);
          this.isSearching.set(false);
        }
      } else if (msg.type === 'search-error') {
        this.error.set(msg.error);
        this.isSearching.set(false);
        this.lastSearchStartedAt = null;
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
    this.filterQuery.set('');
    this.filteredEntries.set(null);
    this.isSearching.set(false);
    this.lastSearchDurationMs.set(null);
    this.lastSearchResultCount.set(null);
    this.lastSearchStartedAt = null;
  }

  setFilterQuery(query: string): void {
    const normalized = query.trim().toLowerCase();
    this.filterQuery.set(normalized);
    this.lastSearchDurationMs.set(null);
    this.lastSearchResultCount.set(null);

    // Check cache first for instant results
    const cachedResult = this.searchCache.get(normalized);
    if (cachedResult !== undefined) {
      this.filteredEntries.set(cachedResult);
      this.lastSearchResultCount.set(cachedResult.length);
      // Simulate minimal cache hit latency
      this.lastSearchDurationMs.set(0.5);
      return;
    }

    if (!this.worker) {
      // Fallback: if worker is not available, just filter on main thread using searchText
      if (!normalized) {
        this.filteredEntries.set(this.allEntries());
        this.lastSearchResultCount.set(this.allEntries().length);
      } else {
        const { tokens, phrases } = tokenizeQueryFallback(normalized);

        if (tokens.length === 0 && phrases.length === 0) {
          this.filteredEntries.set(this.allEntries());
          this.lastSearchResultCount.set(this.allEntries().length);
        } else {
          // Ensure entries have a computed searchText when worker isn't available
          for (const ent of this.allEntries()) {
            const existing = (ent as any).searchText as string | undefined;
            if (typeof existing !== 'string') {
              try {
                (ent as any).searchText = computeSearchTextForEntry(ent);
              } catch {
                (ent as any).searchText = '';
              }
            }
          }

          const scoredResults = this.allEntries()
            .map((entry) => {
              const search = (entry as any).searchText as string | undefined;
              if (typeof search !== 'string') return null;

              if (matchesQueryFallback(search, tokens, phrases)) {
                const score = calculateRelevanceFallback(search, tokens, phrases);
                return { entry, score };
              }
              return null;
            })
            .filter((result): result is { entry: ParsedLogEntry; score: number } => result !== null)
            .sort((a, b) => b.score - a.score);

          const filtered = scoredResults.map((result) => result.entry);
          this.filteredEntries.set(filtered);
          this.lastSearchResultCount.set(filtered.length);
        }
        this.searchCache.set(normalized, this.filteredEntries() ?? []);
      }
      return;
    }

    const msg: WorkerSearchMessage = { type: 'search', query: normalized };
    this.isSearching.set(true);
    this.lastSearchStartedAt = performance.now();
    this.worker.postMessage(msg);
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

/**
 * Enhanced tokenization for full-text search (fallback implementation)
 */
function tokenizeQueryFallback(query: string): { tokens: string[]; phrases: string[] } {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { tokens: [], phrases: [] };

  const tokens: string[] = [];
  const phrases: string[] = [];

  // Extract quoted phrases first
  const phraseRegex = /"([^"]*)"/g;
  let match;
  let remainingQuery = trimmed;

  while ((match = phraseRegex.exec(trimmed)) !== null) {
    phrases.push(match[1].trim());
    remainingQuery = remainingQuery.replace(match[0], '');
  }

  // Tokenize remaining text
  const rawTokens = remainingQuery
    .split(/[\s\-_.,;:/\\|()[\]{}<>"']+/)
    .filter((token) => token.length > 0 && token.length >= 2);

  // Apply basic stemming
  const stemmedTokens = rawTokens.map(stemWordFallback);

  tokens.push(...stemmedTokens);

  return { tokens, phrases };
}

/**
 * Basic word stemming (fallback implementation)
 */
function stemWordFallback(word: string): string {
  const suffixes = ['ing', 'ly', 'ed', 'ies', 'ied', 's', 'es'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 1) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/**
 * Calculate relevance score (fallback implementation)
 */
function calculateRelevanceFallback(searchText: string, tokens: string[], phrases: string[]): number {
  let score = 0;

  // Exact phrase matches get highest score
  for (const phrase of phrases) {
    if (searchText.includes(phrase)) {
      score += 100;
    }
  }

  // Token matches get points based on position and frequency
  for (const token of tokens) {
    const lowerSearch = searchText.toLowerCase();
    let tokenScore = 0;

    const occurrences = (lowerSearch.match(new RegExp(token, 'g')) || []).length;
    tokenScore += occurrences * 10;

    if (new RegExp(`\\b${token}\\b`).test(lowerSearch)) {
      tokenScore += 20;
    }

    if (lowerSearch.startsWith(token)) {
      tokenScore += 15;
    }

    score += tokenScore;
  }

  return score;
}

/**
 * Enhanced matching with fuzzy support (fallback implementation)
 */
function matchesQueryFallback(searchText: string, tokens: string[], phrases: string[]): boolean {
  const lowerSearch = searchText.toLowerCase();

  // All phrases must match exactly
  for (const phrase of phrases) {
    if (!lowerSearch.includes(phrase)) {
      return false;
    }
  }

  // For tokens, use fuzzy matching if exact match fails
  for (const token of tokens) {
    let found = false;

    if (lowerSearch.includes(token)) {
      found = true;
    } else {
      // Simple fuzzy matching
      const words = lowerSearch.split(/[\s\-_.,;:/\\|()[\]{}<>"']+/);
      for (const word of words) {
        if (word.length >= 3 && fuzzyMatchFallback(word, token, 1)) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      return false;
    }
  }

  return true;
}

/**
 * Simple fuzzy matching (fallback implementation)
 */
function fuzzyMatchFallback(text: string, query: string, maxDistance: number = 2): boolean {
  if (Math.abs(text.length - query.length) > maxDistance) return false;

  let distance = 0;
  const maxLen = Math.max(text.length, query.length);

  for (let i = 0; i < maxLen; i++) {
    if (text[i] !== query[i]) {
      distance++;
      if (distance > maxDistance) return false;
    }
  }

  return distance <= maxDistance;
}

// Small helper to safely stringify values for the fallback search index
function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

// Compute a lightweight searchText for an entry (mirrors worker computeSearchText)
function computeSearchTextForEntry(entry: ParsedLogEntry): string {
  const parts: string[] = [];
  parts.push(entry.kind ?? '');

  switch (entry.kind) {
    case 'pino': {
      const e = entry.entry as any;
      parts.push(safeString(e.msg));
      parts.push(safeString(e.hostname));
      parts.push(safeString(e.pid));
      parts.push(safeString(e.name));
      parts.push(safeString(e.time));
      break;
    }
    case 'winston': {
      const e = entry.entry as any;
      parts.push(safeString(e.message));
      parts.push(safeString(e.level));
      parts.push(safeString((e.meta as any)?.requestId));
      parts.push(safeString((e.meta as any)?.userId));
      break;
    }
    case 'loki': {
      const e = entry.entry as any;
      parts.push(safeString(e.line));
      parts.push(safeString((e.labels as any)?.['job']));
      parts.push(safeString((e.labels as any)?.['level']));
      parts.push(safeString(e.ts));
      break;
    }
    case 'promtail': {
      const e = entry.entry as any;
      parts.push(safeString(e.message));
      parts.push(safeString(e.level));
      parts.push(safeString(e.ts));
      break;
    }
    case 'docker': {
      const e = entry.entry as any;
      parts.push(safeString(e.log));
      parts.push(safeString(e.stream));
      parts.push(safeString(e.time));
      break;
    }
    case 'text': {
      parts.push(safeString((entry.entry as any).line));
      break;
    }
    case 'unknown-json':
    default: {
      try {
        parts.push(JSON.stringify(entry.entry));
      } catch {
        parts.push(safeString(entry.entry));
      }
      break;
    }
  }

  // Append normalized tokens using existing helpers
  try {
    const lvl = normalizeLogLevel(entry);
    const env = normalizeEnvironment(entry);
    parts.push(lvl);
    parts.push(`level:${lvl}`);
    parts.push(env);
    parts.push(`env:${env}`);
  } catch {
    // ignore
  }

  return parts.join(' | ').toLowerCase();
}

// Patch: in setFilterQuery fallback branch compute missing searchText before searching
