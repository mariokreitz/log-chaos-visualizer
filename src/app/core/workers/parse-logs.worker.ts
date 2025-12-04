/// <reference lib="webworker" />

interface ParseProgress {
    processedBytes: number;
    totalBytes: number;
    percent: number;
}

interface ParseSummary {
    lines: number;
    jsonObjects: number;
}

interface WorkerStartMessage {
    type: 'start';
    file: File;
    chunkSize: number;
}

type WorkerMessage =
  | { type: 'progress'; progress: ParseProgress }
  | { type: 'summary'; summary: ParseSummary }
  | { type: 'done' }
  | { type: 'error'; error: string };

function getExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

addEventListener('message', async ({ data }: MessageEvent<WorkerStartMessage>) => {
    const msg = data;
    if (!msg || msg.type !== 'start') {
        postMessage({ type: 'error', error: 'Invalid start message' } satisfies WorkerMessage);
        return;
    }

    const { file, chunkSize } = msg;
    const total = file.size;
    let processed = 0;
    let lines = 0;
    let jsonObjects = 0;

    const ext = getExtension(file.name);
    const decoder = new TextDecoder('utf-8');

    let remainder = '';

    try {
        for (let offset = 0; offset < total; offset += chunkSize) {
            const slice = file.slice(offset, Math.min(offset + chunkSize, total));
            const chunkText = await readSliceAsText(slice, decoder);

            const text = remainder + chunkText;
            remainder = '';

            const parts = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            remainder = parts.pop() ?? '';

            if (ext === '.txt' || ext === '.log') {
                lines += parts.length;
            }

            if (ext === '.json') {
                for (const line of parts) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const obj = JSON.parse(trimmed);
                        jsonObjects += 1;
                        lines += 1;
                    } catch {
                        // ignore malformed JSON line – could be pretty-printed JSON; future improvement: streaming parser
                    }
                }
            }

            processed = Math.min(offset + chunkSize, total);
            const progress: ParseProgress = {
                processedBytes: processed,
                totalBytes: total,
                percent: total === 0 ? 100 : Math.round((processed / total) * 100),
            };
            postMessage({ type: 'progress', progress } satisfies WorkerMessage);

        }

        if (remainder) {
            lines += 1;
            if (ext === '.json') {
                try {
                    const obj = JSON.parse(remainder.trim());
                    jsonObjects += 1;
                } catch {
                    // ignore
                }
            }
        }

        const summary: ParseSummary = { lines, jsonObjects };
        postMessage({ type: 'summary', summary } satisfies WorkerMessage);
        postMessage({ type: 'done' } satisfies WorkerMessage);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        postMessage({ type: 'error', error: message } satisfies WorkerMessage);
    }
});

function readSliceAsText(blob: Blob, decoder: TextDecoder): Promise<string> {
    return blob.text().then(t => t);
}
