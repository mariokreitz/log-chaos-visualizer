/// <reference lib="webworker" />

import type {
  ExtendedParseSummary,
  ParsedBatch,
  ParsedKind,
  ParsedLogEntry,
  ParseProgress,
  WorkerMessage,
  WorkerSearchMessage,
  WorkerStartMessage,
} from '../types/file-parse.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../types/log-entries';
import { FieldIndexer } from '../utils/field-indexer';
import { evaluateQuery } from '../utils/query-evaluator';
import { parseQuery } from '../utils/query-parser';
import { computeSearchText, getNormalizedEnvironment, getNormalizedLevel } from '../utils/search-utils';

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

const allEntries: ParsedLogEntry[] = [];
const fieldIndexer = new FieldIndexer();
const queryCache = new Map<string, { ast: any; timestamp: number }>();

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
  const query = raw.trim();

  postMessage({ type: 'search-start', query: query.toLowerCase() } satisfies WorkerMessage);

  if (!query) {
    postMessage({
      type: 'search-result',
      query: query.toLowerCase(),
      entries: allEntries.slice(),
    } satisfies WorkerMessage);
    return;
  }

  try {
    const parsedQuery = parseQuery(query);

    console.log(`[Worker] Query: "${query}"`);
    console.log(
      `[Worker] Parsed - isLegacy: ${parsedQuery.isLegacyTextSearch}, hasAST: ${!!parsedQuery.ast}, errors: ${parsedQuery.errors.length}`,
    );

    if (!parsedQuery.isLegacyTextSearch && parsedQuery.ast) {
      if (parsedQuery.errors.length > 0) {
        const error = parsedQuery.errors.map((e) => e.message).join('; ');
        console.log(`[Worker] Query errors: ${error}`);
        postMessage({ type: 'search-error', query: query.toLowerCase(), error } satisfies WorkerMessage);
        return;
      }

      const result = evaluateQuery(parsedQuery.ast, {
        entries: allEntries,
        indexer: fieldIndexer,
      });

      const filtered = result.matchedIndices.map((idx) => allEntries[idx]);

      console.log(
        `[Worker] Query evaluated in ${result.evaluationTimeMs.toFixed(2)}ms, found ${filtered.length} matches (indexed: ${result.usedIndexes})`,
      );

      postMessage({ type: 'search-result', query: query.toLowerCase(), entries: filtered } satisfies WorkerMessage);
      return;
    }

    const lowerQuery = query.toLowerCase();
    let { tokens, phrases } = tokenizeQuery(lowerQuery);

    let unknownRequested = false;
    if (tokens.includes('unknown')) {
      unknownRequested = true;
      tokens = tokens.filter((t) => t !== 'unknown');
    }

    if (tokens.length === 0 && phrases.length === 0 && !unknownRequested) {
      postMessage({ type: 'search-result', query: lowerQuery, entries: allEntries.slice() } satisfies WorkerMessage);
      return;
    }

    const hasSearchTokens = tokens.length > 0 || phrases.length > 0;

    const scoredResults = allEntries
      .map((entry) => {
        const search = (entry as any).searchText as string | undefined;
        if (typeof search !== 'string') return null;

        if (hasSearchTokens && matchesQuery(search, tokens, phrases)) {
          const score = calculateRelevance(search, tokens, phrases);
          return { entry, score };
        }

        if (unknownRequested) {
          try {
            const lvl = getNormalizedLevel(entry);
            const env = getNormalizedEnvironment(entry);
            if (lvl === 'unknown' || env === 'unknown' || search.includes('unknown')) {
              let score = 30;
              if (lvl === 'unknown') score += 10;
              if (env === 'unknown') score += 10;
              return { entry, score };
            }
          } catch {
            // ignore
          }
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
          const startIndex = allEntries.length - batchEntries.length;
          fieldIndexer.addBatch(batchEntries, startIndex);

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
      const startIndex = allEntries.length - batchEntries.length;
      fieldIndexer.addBatch(batchEntries, startIndex);

      const finalBatch: ParsedBatch = {
        entries: batchEntries.slice(),
        rawCount: batchRawCount,
        malformedCount: batchMalformed,
        chunkStartOffset: total - (total % chunkSize),
        chunkEndOffset: total,
      };
      postMessage({ type: 'batch', batch: finalBatch } satisfies WorkerMessage);
    }

    const indexStats = fieldIndexer.getStats();
    console.log('[Worker] Field indexes built:', indexStats);

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
