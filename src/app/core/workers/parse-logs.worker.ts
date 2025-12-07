/// <reference lib="webworker" />

import type {
  ExtendedParseSummary,
  ParsedKind,
  ParsedLogEntry,
  WorkerMessage,
  WorkerSearchMessage,
  WorkerStartMessage,
} from '../types/file-parse.types';
import { BatchPoster } from '../utils/batch-poster';
import { FieldIndexer } from '../utils/field-indexer';

import { parseJsonObject, parseTextLine } from '../utils/log-line-parser';
import { evaluateQuery } from '../utils/query-evaluator';
import { parseQuery } from '../utils/query-parser';
import { getNormalizedEnvironment, getNormalizedLevel } from '../utils/search-utils';
import { calculateRelevance, matchesQuery, tokenizeQuery } from '../utils/search-utils-worker';

const allEntries: ParsedLogEntry[] = [];
const fieldIndexer = new FieldIndexer();

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return 'Unknown error';
  }
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
    const { tokens, phrases } = tokenizeQuery(lowerQuery);
    let tokenList = tokens;

    let unknownRequested = false;
    if (tokenList.includes('unknown')) {
      unknownRequested = true;
      tokenList = tokenList.filter((t) => t !== 'unknown');
    }

    if (tokenList.length === 0 && phrases.length === 0 && !unknownRequested) {
      postMessage({ type: 'search-result', query: lowerQuery, entries: allEntries.slice() } satisfies WorkerMessage);
      return;
    }

    const hasSearchTokens = tokenList.length > 0 || phrases.length > 0;

    // Process in chunks to enable streaming results for large datasets
    const CHUNK_SIZE = 5000;
    const allResults: { entry: ParsedLogEntry; score: number }[] = [];

    for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
      const chunk = allEntries.slice(i, i + CHUNK_SIZE);

      const chunkResults = chunk
        .map((entry) => {
          const entryWithSearch = entry as ParsedLogEntry & { searchText?: string };
          if (typeof entryWithSearch.searchText !== 'string') return null;

          if (hasSearchTokens && matchesQuery(entryWithSearch.searchText, tokenList, phrases)) {
            const score = calculateRelevance(entryWithSearch.searchText, tokenList, phrases);
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
    const error = formatError(e);
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

  const batchPoster = new BatchPoster(500);

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
        let incrementMalformed = 0;

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const obj = JSON.parse(trimmed) as unknown;
            parsed = parseJsonObject(obj);
          } catch {
            malformedCount += 1;
            incrementMalformed = 1;
            parsed = parseTextLine(trimmed);
          }
        } else {
          parsed = parseTextLine(trimmed);
        }

        allEntries.push(parsed);
        const batch = batchPoster.add(parsed, incrementMalformed);
        counts[parsed.kind] += 1;

        if (batch) {
          postMessage({ type: 'batch', batch } satisfies WorkerMessage);
        }
      }

      // Optionally post progress updates
      processed += chunkSize;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      postMessage({
        type: 'progress',
        progress: { processedBytes: Math.min(processed, total), totalBytes: total, percent: (processed / total) * 100 },
      } satisfies WorkerMessage);
    }

    // After reading all slices, if there's remainder text that forms a final line, parse it
    if (remainder.trim()) {
      try {
        const obj = JSON.parse(remainder) as unknown;
        const parsed = parseJsonObject(obj);
        allEntries.push(parsed);
        const batch = batchPoster.add(parsed);
        if (batch) postMessage({ type: 'batch', batch } satisfies WorkerMessage);
      } catch {
        const parsed = parseTextLine(remainder);
        allEntries.push(parsed);
        const batch = batchPoster.add(parsed);
        if (batch) postMessage({ type: 'batch', batch } satisfies WorkerMessage);
      }
    }

    // Post any remaining entries as a final batch
    const finalBatch = batchPoster.flushFinal(total);
    if (finalBatch) {
      postMessage({ type: 'batch', batch: finalBatch } satisfies WorkerMessage);
    }

    // Optionally post a final progress update
    postMessage({
      type: 'progress',
      progress: { processedBytes: total, totalBytes: total, percent: 100 },
    } satisfies WorkerMessage);

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
    const error = formatError(err);
    postMessage({ type: 'error', error } satisfies WorkerMessage);
  }
});
