/// <reference lib="webworker" />

import type {
  ExtendedParseSummary,
  ParsedBatch,
  ParsedKind,
  ParsedLogEntry,
  ParseProgress,
  WorkerMessage,
  WorkerSearchMessage,
  WorkerStartMessage
} from '../types/file-parse.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../types/log-entries';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPinoEntry(candidate: unknown): candidate is PinoEntry {
  if (!isRecord(candidate)) return false;
  const level = candidate['level'];
  return (
    typeof candidate['time'] === 'number' &&
    typeof level === 'number' &&
    (level === 10 || level === 20 || level === 30 || level === 40 || level === 50 || level === 60) &&
    typeof candidate['msg'] === 'string' &&
    typeof candidate['pid'] === 'number' &&
    typeof candidate['hostname'] === 'string' &&
    typeof candidate['name'] === 'string'
  );
}

function isWinstonEntry(candidate: unknown): candidate is WinstonEntry {
  if (!isRecord(candidate)) return false;
  const level = candidate['level'];
  const message = candidate['message'];
  const timestamp = candidate['timestamp'];
  if (typeof timestamp !== 'string' || typeof message !== 'string' || typeof level !== 'string') {
    return false;
  }
  if (typeof (candidate as Record<string, unknown>)['ts'] === 'string') {
    return false;
  }
  return (
    level === 'silly' ||
    level === 'debug' ||
    level === 'verbose' ||
    level === 'info' ||
    level === 'warn' ||
    level === 'error'
  );
}

function isLokiEntry(candidate: unknown): candidate is LokiEntry {
  if (!isRecord(candidate)) return false;
  return typeof candidate['ts'] === 'string' && isRecord(candidate['labels']) && typeof candidate['line'] === 'string';
}

function isPromtailTextLine(candidate: unknown): candidate is PromtailTextLine {
  if (!isRecord(candidate)) return false;
  const level = candidate['level'];
  const message = candidate['message'];
  return (
    typeof candidate['ts'] === 'string' &&
    typeof message === 'string' &&
    typeof level === 'string' &&
    (level === 'debug' || level === 'info' || level === 'warn' || level === 'error')
  );
}

function isDockerLogLine(candidate: unknown): candidate is DockerLogLine {
  if (!isRecord(candidate)) return false;
  const stream = candidate['stream'];
  return (
    typeof candidate['log'] === 'string' &&
    typeof candidate['time'] === 'string' &&
    typeof stream === 'string' &&
    (stream === 'stdout' || stream === 'stderr')
  );
}

function mapJsonObjectToParsed(candidate: unknown): ParsedLogEntry {
  if (isPinoEntry(candidate)) {
    return { kind: 'pino', entry: candidate };
  }
  if (isDockerLogLine(candidate)) {
    return { kind: 'docker', entry: candidate };
  }
  // Promtail entries are a subset of what Winston accepts (level+message) but
  // additionally have 'ts', so check Promtail before Winston.
  if (isPromtailTextLine(candidate)) {
    return { kind: 'promtail', entry: candidate };
  }
  if (isWinstonEntry(candidate)) {
    return { kind: 'winston', entry: candidate };
  }
  if (isLokiEntry(candidate)) {
    return { kind: 'loki', entry: candidate };
  }
  return { kind: 'unknown-json', entry: candidate };
}

function mapTextLine(line: string): ParsedLogEntry {
  const trimmed = line.trim();
  if (!trimmed) {
    return { kind: 'text', entry: { line: '' } };
  }
  return { kind: 'text', entry: { line: trimmed } };
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

// New: normalize a parsed entry's level into a human friendly token
function getNormalizedLevel(parsed: ParsedLogEntry): string {
  try {
    switch (parsed.kind) {
      case 'pino': {
        const lvl = (parsed.entry as PinoEntry).level;
        if (lvl === 10) return 'trace';
        if (lvl === 20) return 'debug';
        if (lvl === 30) return 'info';
        if (lvl === 40) return 'warn';
        if (lvl === 50) return 'error';
        if (lvl === 60) return 'fatal';
        return 'unknown';
      }
      case 'winston': {
        const lvl = (parsed.entry as WinstonEntry & Record<string, unknown>).level as unknown;
        if (typeof lvl === 'string') {
          const l = (lvl as string).toLowerCase();
          if (l === 'silly' || l === 'verbose') return 'trace';
          if (l === 'debug') return 'debug';
          if (l === 'info') return 'info';
          if (l === 'warn') return 'warn';
          if (l === 'error') return 'error';
          return 'unknown';
        }
        return 'unknown';
      }
      case 'promtail': {
        const lvl = (parsed.entry as PromtailTextLine & Record<string, unknown>).level as unknown;
        if (typeof lvl === 'string') {
          const l = (lvl as string).toLowerCase();
          if (l === 'debug' || l === 'info' || l === 'warn' || l === 'error') return l;
        }
        return 'unknown';
      }
      case 'loki': {
        const lvl = (parsed.entry as LokiEntry & Record<string, unknown>).labels?.['level'];
        if (typeof lvl === 'string') return (lvl as string).toLowerCase();
        return 'unknown';
      }
      case 'docker': {
        const log = (parsed.entry as DockerLogLine & Record<string, unknown>).log ?? '';
        const m = /level=(trace|debug|info|warn|error|fatal)\b/i.exec(String(log));
        if (m) return m[1].toLowerCase();
        return 'unknown';
      }
      case 'text': {
        const line = (parsed.entry as any).line ?? '';
        const firstToken = String(line).split(/\s+/, 1)[0];
        const upperToken = firstToken.toUpperCase();
        if (upperToken === 'TRACE') return 'trace';
        if (upperToken === 'DEBUG') return 'debug';
        if (upperToken === 'INFO') return 'info';
        if (upperToken === 'WARN') return 'warn';
        if (upperToken === 'ERROR') return 'error';
        if (upperToken === 'FATAL') return 'fatal';
        return 'unknown';
      }
      case 'unknown-json':
      default: {
        // Try to heuristically find a level property in unknown JSON
        const obj = parsed.entry as Record<string, unknown> | undefined;
        if (obj) {
          const candidate = (obj['level'] ?? obj['logLevel'] ?? obj['lvl'] ?? obj['severity']) as unknown;
          if (typeof candidate === 'string') {
            const lc = candidate.toLowerCase();
            if (lc.includes('trace')) return 'trace';
            if (lc.includes('debug')) return 'debug';
            if (lc.includes('info')) return 'info';
            if (lc.includes('warn')) return 'warn';
            if (lc.includes('error')) return 'error';
            if (lc.includes('fatal')) return 'fatal';
          }
        }
        return 'unknown';
      }
    }
  } catch {
    return 'unknown';
  }
}

// New: normalize environment names (dev/staging/prod/unknown)
function getNormalizedEnvironment(parsed: ParsedLogEntry): string {
  try {
    switch (parsed.kind) {
      case 'loki': {
        const env = (parsed.entry as LokiEntry & Record<string, unknown>).labels?.['environment'];
        if (env === 'dev' || env === 'staging' || env === 'prod') return env;
        return 'unknown';
      }
      case 'pino': {
        const meta = (parsed.entry as PinoEntry & Record<string, unknown>).meta as Record<string, unknown> | undefined;
        const env = meta ? meta['environment'] : undefined;
        if (env === 'dev' || env === 'staging' || env === 'prod') return env as string;
        return 'unknown';
      }
      case 'winston': {
        const meta = (parsed.entry as WinstonEntry & Record<string, unknown>).meta as
          | Record<string, unknown>
          | undefined;
        const env = meta ? meta['environment'] : undefined;
        if (env === 'dev' || env === 'staging' || env === 'prod') return env as string;
        return 'unknown';
      }
      case 'promtail': {
        const anyE = parsed.entry as unknown as { environment?: string };
        if (anyE && (anyE.environment === 'dev' || anyE.environment === 'staging' || anyE.environment === 'prod'))
          return anyE.environment as string;
        return 'unknown';
      }
      case 'docker': {
        const log = (parsed.entry as DockerLogLine & Record<string, unknown>).log ?? '';
        const m = /env=(dev|staging|prod)\b/i.exec(String(log));
        if (m) return m[1].toLowerCase();
        return 'unknown';
      }
      case 'text': {
        const line = (parsed.entry as any).line ?? '';
        const m = /env=(dev|staging|prod)\b/i.exec(String(line));
        if (m) return m[1].toLowerCase();
        return 'unknown';
      }
      case 'unknown-json':
      default: {
        try {
          const obj = parsed.entry as Record<string, unknown> | undefined;
          if (obj) {
            const env = (obj['environment'] ?? obj['env'] ?? obj['envName']) as unknown;
            if (env === 'dev' || env === 'staging' || env === 'prod') return env as string;
          }
        } catch {
          // ignore
        }
        return 'unknown';
      }
    }
  } catch {
    return 'unknown';
  }
}

function computeSearchText(parsed: ParsedLogEntry): string {
  const parts: string[] = [];
  parts.push(parsed.kind ?? '');
  switch (parsed.kind) {
    case 'pino': {
      const e = parsed.entry as PinoEntry;
      parts.push(safeString(e.msg));
      parts.push(safeString(e.hostname));
      parts.push(safeString(e.pid));
      parts.push(safeString(e.name));
      parts.push(safeString(e.time));
      break;
    }
    case 'winston': {
      const e = parsed.entry as WinstonEntry & Record<string, unknown>;
      parts.push(safeString(e.message));
      parts.push(safeString(e.level));
      parts.push(safeString((e.meta as any)?.requestId));
      parts.push(safeString((e.meta as any)?.userId));
      break;
    }
    case 'loki': {
      const e = parsed.entry as LokiEntry & Record<string, any>;
      parts.push(safeString(e.line));
      parts.push(safeString((e.labels as any)?.['job']));
      parts.push(safeString((e.labels as any)?.['level']));
      parts.push(safeString(e.ts));
      break;
    }
    case 'promtail': {
      const e = parsed.entry as PromtailTextLine & Record<string, any>;
      parts.push(safeString(e.message));
      parts.push(safeString(e.level));
      parts.push(safeString(e.ts));
      break;
    }
    case 'docker': {
      const e = parsed.entry as DockerLogLine & Record<string, any>;
      parts.push(safeString(e.log));
      parts.push(safeString(e.stream));
      parts.push(safeString(e.time));
      break;
    }
    case 'text': {
      parts.push(safeString((parsed.entry as any).line));
      break;
    }
    case 'unknown-json':
    default: {
      try {
        parts.push(JSON.stringify(parsed.entry));
      } catch {
        parts.push(safeString(parsed.entry));
      }
      break;
    }
  }

  // Append normalized level and environment tokens to the search text so
  // queries like "fatal" or "env=prod" match consistently across kinds.
  const normalizedLevel = getNormalizedLevel(parsed);
  const normalizedEnv = getNormalizedEnvironment(parsed);

  parts.push(normalizedLevel);
  parts.push(`level:${normalizedLevel}`);
  parts.push(normalizedEnv);
  parts.push(`env:${normalizedEnv}`);

  return parts.join(' | ').toLowerCase();
}

const allEntries: ParsedLogEntry[] = [];

function tokenizeQuery(query: string): { tokens: string[]; phrases: string[] } {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { tokens: [], phrases: [] };

  const tokens: string[] = [];
  const phrases: string[] = [];

  const phraseRegex = /"([^"]*)"/g;
  let match;
  let remainingQuery = trimmed;

  while ((match = phraseRegex.exec(trimmed)) !== null) {
    phrases.push(match[1].trim());
    remainingQuery = remainingQuery.replace(match[0], '');
  }

  const rawTokens = remainingQuery.split(/[\s\-_.,;:/\\|()[\]{}<>"']+/).filter((token) => token.length > 0);

  const stemmedTokens = rawTokens.map(stemWord);

  tokens.push(...stemmedTokens);

  return { tokens, phrases };
}

function stemWord(word: string): string {
  const suffixes = ['ing', 'ly', 'ed', 'ies', 'ied', 'ies', 'ied', 's', 'es'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 1) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function calculateRelevance(searchText: string, tokens: string[], phrases: string[]): number {
  let score = 0;

  for (const phrase of phrases) {
    if (searchText.includes(phrase)) {
      score += 100;
    }
  }

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

function fuzzyMatch(text: string, query: string, maxDistance: number = 2): boolean {
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

function matchesQuery(searchText: string, tokens: string[], phrases: string[]): boolean {
  const lowerSearch = searchText.toLowerCase();

  for (const phrase of phrases) {
    if (!lowerSearch.includes(phrase)) {
      return false;
    }
  }

  for (const token of tokens) {
    let found = false;

    if (lowerSearch.includes(token)) {
      found = true;
    } else {
      const words = lowerSearch.split(/[\s\-_.,;:/\\|()[\]{}<>"']+/);
      for (const word of words) {
        if (word.length >= 3 && fuzzyMatch(word, token, 1)) {
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

function handleSearchMessage(msg: WorkerSearchMessage): void {
  const raw = msg.query ?? '';
  const query = raw.trim().toLowerCase();

  postMessage({ type: 'search-start', query } satisfies WorkerMessage);

  if (!query) {
    postMessage({ type: 'search-result', query, entries: allEntries.slice() } satisfies WorkerMessage);
    return;
  }

  try {
    const { tokens, phrases } = tokenizeQuery(query);

    // If no valid tokens after tokenization, return all entries
    if (tokens.length === 0 && phrases.length === 0) {
      postMessage({ type: 'search-result', query, entries: allEntries.slice() } satisfies WorkerMessage);
      return;
    }

    const scoredResults = allEntries
      .map((entry) => {
        const search = (entry as any).searchText as string | undefined;
        if (typeof search !== 'string') return null;

        if (matchesQuery(search, tokens, phrases)) {
          const score = calculateRelevance(search, tokens, phrases);
          return { entry, score };
        }
        return null;
      })
      .filter((result): result is { entry: ParsedLogEntry; score: number } => result !== null)
      .sort((a, b) => b.score - a.score); // Sort by relevance (highest first)

    const filtered = scoredResults.map((result) => result.entry);

    postMessage({ type: 'search-result', query, entries: filtered } satisfies WorkerMessage);
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown search error';
    postMessage({ type: 'search-error', query, error } satisfies WorkerMessage);
  }
}

addEventListener('message', async ({ data }: MessageEvent<WorkerStartMessage | WorkerSearchMessage>) => {
  const msg = data;

  if (!msg) {
    postMessage({ type: 'error', error: 'Invalid message' } satisfies WorkerMessage);
    return;
  }

  if (msg.type === 'search') {
    handleSearchMessage(msg);
    return;
  }

  if (msg.type !== 'start') {
    postMessage({ type: 'error', error: 'Invalid start message' } satisfies WorkerMessage);
    return;
  }

  const { file, chunkSize, delayMs = 0 } = msg;
  const total = file.size;

  let processed = 0;
  let totalLines = 0;
  let malformedCount = 0;
  const counts: Record<ParsedKind, number> = {
    pino: 0,
    winston: 0,
    loki: 0,
    promtail: 0,
    docker: 0,
    'unknown-json': 0,
    text: 0,
  };

  const batchEntries: ParsedLogEntry[] = [];
  let batchRawCount = 0;
  let batchMalformed = 0;
  const BATCH_SIZE = 500;

  let remainder = '';

  try {
    for (let offset = 0; offset < total; offset += chunkSize) {
      const slice = file.slice(offset, Math.min(offset + chunkSize, total));
      const chunkText = await readSliceAsText(slice);

      const text = remainder + chunkText;
      remainder = '';

      const parts = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      remainder = parts.pop() ?? '';

      for (const line of parts) {
        totalLines += 1;
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        let parsed: ParsedLogEntry;

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const obj = JSON.parse(trimmed) as unknown;
            parsed = mapJsonObjectToParsed(obj);
          } catch {
            malformedCount += 1;
            batchMalformed += 1;
            parsed = mapTextLine(trimmed);
          }
        } else {
          parsed = mapTextLine(trimmed);
        }

        // compute a lightweight search index for fast client-side filtering
        (parsed as any).searchText = computeSearchText(parsed);

        allEntries.push(parsed);
        batchEntries.push(parsed);
        batchRawCount += 1;
        counts[parsed.kind] += 1;

        if (batchEntries.length >= BATCH_SIZE) {
          const batch: ParsedBatch = {
            entries: batchEntries.slice(),
            rawCount: batchRawCount,
            malformedCount: batchMalformed,
            chunkStartOffset: offset,
            chunkEndOffset: Math.min(offset + chunkSize, total),
          };
          postMessage({ type: 'batch', batch } satisfies WorkerMessage);
          batchEntries.length = 0;
          batchRawCount = 0;
          batchMalformed = 0;
        }
      }

      processed = Math.min(offset + chunkSize, total);
      const progress: ParseProgress = {
        processedBytes: processed,
        totalBytes: total,
        percent: total === 0 ? 100 : Math.round((processed / total) * 100),
      };
      postMessage({ type: 'progress', progress } satisfies WorkerMessage);

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    if (remainder.trim()) {
      totalLines += 1;
      const trimmed = remainder.trim();
      let parsed: ParsedLogEntry;
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const obj = JSON.parse(trimmed) as unknown;
          parsed = mapJsonObjectToParsed(obj);
        } catch {
          malformedCount += 1;
          batchMalformed += 1;
          parsed = mapTextLine(trimmed);
        }
      } else {
        parsed = mapTextLine(trimmed);
      }
      (parsed as any).searchText = computeSearchText(parsed);
      allEntries.push(parsed);
      batchEntries.push(parsed);
      batchRawCount += 1;
      counts[parsed.kind] += 1;
    }

    if (batchEntries.length > 0) {
      const finalBatch: ParsedBatch = {
        entries: batchEntries.slice(),
        rawCount: batchRawCount,
        malformedCount: batchMalformed,
        chunkStartOffset: total - (total % chunkSize),
        chunkEndOffset: total,
      };
      postMessage({ type: 'batch', batch: finalBatch } satisfies WorkerMessage);
    }

    const summary: ExtendedParseSummary = {
      totalLines,
      malformedCount,
      counts,
      levelSummary: {
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
      },
      environmentSummary: {
        total: 0,
        byEnvironment: {
          dev: 0,
          staging: 0,
          prod: 0,
          unknown: 0,
        },
      },
    };
    postMessage({ type: 'summary', summary } satisfies WorkerMessage);
    postMessage({ type: 'done' } satisfies WorkerMessage);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    postMessage({ type: 'error', error: message } satisfies WorkerMessage);
  }
});

async function readSliceAsText(blob: Blob): Promise<string> {
  return await blob.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
