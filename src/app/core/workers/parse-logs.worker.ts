/// <reference lib="webworker" />

import type {
    ExtendedParseSummary,
    ParsedBatch,
    ParsedKind,
    ParsedLogEntry,
    ParseProgress,
    WorkerMessage,
    WorkerStartMessage,
} from '../types/file-parse.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../types/log-entries';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isPinoEntry(candidate: unknown): candidate is PinoEntry {
    if (!isRecord(candidate)) return false;
    const level = candidate['level'];
    return (
      typeof candidate['time'] === 'number'
      && typeof level === 'number'
      && (level === 10 || level === 20 || level === 30 || level === 40 || level === 50 || level === 60)
      && typeof candidate['msg'] === 'string'
      && typeof candidate['pid'] === 'number'
      && typeof candidate['hostname'] === 'string'
      && typeof candidate['name'] === 'string'
    );
}

function isWinstonEntry(candidate: unknown): candidate is WinstonEntry {
    if (!isRecord(candidate)) return false;
    const level = candidate['level'];
    const message = candidate['message'];
    if (typeof message !== 'string' || typeof level !== 'string') return false;
    return level === 'silly' || level === 'debug' || level === 'verbose' || level === 'info' || level === 'warn' || level === 'error';
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
      typeof candidate['ts'] === 'string'
      && typeof message === 'string'
      && typeof level === 'string'
      && (level === 'debug' || level === 'info' || level === 'warn' || level === 'error')
    );
}

function isDockerLogLine(candidate: unknown): candidate is DockerLogLine {
    if (!isRecord(candidate)) return false;
    const stream = candidate['stream'];
    return (
      typeof candidate['log'] === 'string'
      && typeof candidate['time'] === 'string'
      && typeof stream === 'string'
      && (stream === 'stdout' || stream === 'stderr')
    );
}

function mapJsonObjectToParsed(candidate: unknown): ParsedLogEntry {
    if (isPinoEntry(candidate)) {
        return { kind: 'pino', entry: candidate };
    }
    if (isDockerLogLine(candidate)) {
        return { kind: 'docker', entry: candidate };
    }
    if (isWinstonEntry(candidate)) {
        return { kind: 'winston', entry: candidate };
    }
    if (isLokiEntry(candidate)) {
        return { kind: 'loki', entry: candidate };
    }
    if (isPromtailTextLine(candidate)) {
        return { kind: 'promtail', entry: candidate };
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

addEventListener('message', async ({ data }: MessageEvent<WorkerStartMessage>) => {
    const msg = data;
    if (!msg || msg.type !== 'start') {
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

    const decoder = new TextDecoder('utf-8');

    const batchEntries: ParsedLogEntry[] = [];
    let batchRawCount = 0;
    let batchMalformed = 0;
    const BATCH_SIZE = 500;

    let remainder = '';

    try {
        for (let offset = 0; offset < total; offset += chunkSize) {
            const slice = file.slice(offset, Math.min(offset + chunkSize, total));
            const chunkText = await readSliceAsText(slice, decoder);

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
                let isJson = false;

                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        const obj = JSON.parse(trimmed) as unknown;
                        parsed = mapJsonObjectToParsed(obj);
                        isJson = true;
                    } catch {
                        malformedCount += 1;
                        batchMalformed += 1;
                        parsed = mapTextLine(trimmed);
                    }
                } else {
                    parsed = mapTextLine(trimmed);
                }

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

async function readSliceAsText(blob: Blob, _decoder: TextDecoder): Promise<string> {
    return await blob.text();
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
