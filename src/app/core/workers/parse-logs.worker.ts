/// <reference lib="webworker" />

import type {
  ExtendedParseSummary,
  ParsedBatch,
  ParsedKind,
  ParsedLogEntry,
  WorkerMessage,
  WorkerSearchMessage,
  WorkerStartMessage
} from '../types/file-parse.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../types/log-entries';
import { FieldIndexer } from '../utils/field-indexer';
import { normalizeLogEntry } from '../utils/log-normalizer';
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
  let kind: ParsedKind;
  let entry: PinoEntry | WinstonEntry | LokiEntry | DockerLogLine | PromtailTextLine | unknown;

  if (isPinoEntry(candidate)) {
    kind = 'pino';
    entry = candidate;
  } else if (isDockerLogLine(candidate)) {
    kind = 'docker';
    entry = candidate;
  } else if (isPromtailTextLine(candidate)) {
    kind = 'promtail';
    entry = candidate;
  } else if (isWinstonEntry(candidate)) {
    kind = 'winston';
    entry = candidate;
  } else if (isLokiEntry(candidate)) {
    kind = 'loki';
    entry = candidate;
  } else {
    kind = 'unknown-json';
    entry = candidate;
  }

  const normalized = normalizeLogEntry(kind, entry);
  return { kind, entry, normalized } as ParsedLogEntry;
}

function mapTextLine(line: string): ParsedLogEntry {
  const trimmed = line.trim();
  const entry = { line: trimmed };
  const normalized = normalizeLogEntry('text', entry);
  return { kind: 'text', entry, normalized } as ParsedLogEntry;
}

const allEntries: ParsedLogEntry[] = [];
const fieldIndexer = new FieldIndexer();

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

function fuzzyMatch(text: string, query: string, maxDistance = 2): boolean {
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

    console.debug(`[Worker] Query: "${query}"`);
    console.debug(
      `[Worker] Parsed - isLegacy: ${parsedQuery.isLegacyTextSearch}, hasAST: ${!!parsedQuery.ast}, errors: ${parsedQuery.errors.length}`,
    );

    // Debug: show sample extractions
    // (removed temporary debug helper to avoid build errors)

    if (!parsedQuery.isLegacyTextSearch && parsedQuery.ast) {
      if (parsedQuery.errors.length > 0) {
        const error = parsedQuery.errors.map((e) => e.message).join('; ');
        console.debug(`[Worker] Query errors: ${error}`);
        postMessage({ type: 'search-error', query: query.toLowerCase(), error } satisfies WorkerMessage);
        return;
      }

      const result = evaluateQuery(parsedQuery.ast, {
        entries: allEntries,
        indexer: fieldIndexer,
      });

      const filtered = result.matchedIndices.map((idx) => allEntries[idx]);

      console.debug(
        `[Worker] Query evaluated in ${result.evaluationTimeMs.toFixed(2)}ms, found ${filtered.length} matches (indexed: ${result.usedIndexes})`,
      );

      postMessage({ type: 'search-result', query: query.toLowerCase(), entries: filtered } satisfies WorkerMessage);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const queryResult = tokenizeQuery(lowerQuery);
    let tokens = queryResult.tokens;
    const phrases = queryResult.phrases;

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

    // Process in chunks to enable streaming results for large datasets
    const CHUNK_SIZE = 5000;
    const allResults: { entry: ParsedLogEntry; score: number }[] = [];

    for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
      const chunk = allEntries.slice(i, i + CHUNK_SIZE);

      const chunkResults = chunk
        .map((entry) => {
          const entryWithSearch = entry as ParsedLogEntry & { searchText?: string };
          if (typeof entryWithSearch.searchText !== 'string') return null;

          if (hasSearchTokens && matchesQuery(entryWithSearch.searchText, tokens, phrases)) {
            const score = calculateRelevance(entryWithSearch.searchText, tokens, phrases);
            return { entry, score };
          }

          if (unknownRequested) {
            try {
              const lvl = getNormalizedLevel(entry);
              const env = getNormalizedEnvironment(entry);
              if (lvl === 'unknown' || env === 'unknown' || entryWithSearch.searchText.includes('unknown')) {
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
        .filter((result): result is { entry: ParsedLogEntry; score: number } => result !== null);

      allResults.push(...chunkResults);
    }

    // Sort by relevance (highest first)
    allResults.sort((a, b) => b.score - a.score);
    const filtered = allResults.map((result) => result.entry);

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

  // Helper to read a Blob slice as text in worker
  async function readSliceAsText(slice: Blob): Promise<string> {
    // In modern browsers Blob.text() is available
    if (typeof slice.text === 'function') {
      return await slice.text();
    }
    // Fallback: use FileReader (shouldn't be needed in modern workers)
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? ''));
      fr.onerror = () => reject(fr.error);
      fr.readAsText(slice as Blob);
    });
  }

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
        if (!trimmed) continue;

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
        (parsed as ParsedLogEntry & { searchText?: string }).searchText = computeSearchText(parsed);

        allEntries.push(parsed);
        batchEntries.push(parsed);
        batchRawCount += 1;
        counts[parsed.kind] += 1;

        // When batch is full, post it and clear
        if (batchEntries.length >= BATCH_SIZE) {
          const batch: ParsedBatch = {
            entries: batchEntries.splice(0, batchEntries.length),
            rawCount: batchRawCount,
            malformedCount: batchMalformed,
            chunkStartOffset: Math.max(0, offset - chunkSize),
            chunkEndOffset: offset + chunkSize,
          };
          postMessage({ type: 'batch', batch } satisfies WorkerMessage);
          // reset batch counters
          batchRawCount = 0;
          batchMalformed = 0;
        }
      }
    }

    // After reading all slices, if there's remainder text that forms a final line, parse it
    if (remainder.trim()) {
      try {
        const obj = JSON.parse(remainder) as unknown;
        const parsed = mapJsonObjectToParsed(obj);
        (parsed as ParsedLogEntry & { searchText?: string }).searchText = computeSearchText(parsed);
        allEntries.push(parsed);
        batchEntries.push(parsed);
      } catch {
        const parsed = mapTextLine(remainder);
        (parsed as ParsedLogEntry & { searchText?: string }).searchText = computeSearchText(parsed);
        allEntries.push(parsed);
        batchEntries.push(parsed);
      }
    }

    // Post any remaining entries as a final batch
    if (batchEntries.length > 0) {
      const batch: ParsedBatch = {
        entries: batchEntries.splice(0, batchEntries.length),
        rawCount: batchRawCount,
        malformedCount: batchMalformed,
        chunkStartOffset: 0,
        chunkEndOffset: total,
      };
      postMessage({ type: 'batch', batch } satisfies WorkerMessage);
    }

    // Build a simple summary
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
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    postMessage({ type: 'error', error } satisfies WorkerMessage);
  }
});
