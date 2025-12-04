import { Injectable, signal } from '@angular/core';

export type ParseProgress = {
    processedBytes: number;
    totalBytes: number;
    percent: number; // 0-100
};

export type ParseSummary = {
    lines: number;
    jsonObjects: number;
};

@Injectable({ providedIn: 'root' })
export class FileParseService {
    // state signals
    readonly selectedFile = signal<File | null>(null);
    readonly progress = signal<ParseProgress | null>(null);
    readonly summary = signal<ParseSummary | null>(null);
    readonly error = signal<string | null>(null);
    readonly isParsing = signal(false);

    private worker: Worker | null = null;

    setFile(file: File | null): void {
        this.reset();
        if (file) {
            this.selectedFile.set(file);
        }
    }

    startParse(chunkSize = 2 * 1024 * 1024): void { // 2MB default
        const file = this.selectedFile();
        if (!file) {
            this.error.set('No file selected.');
            return;
        }
        this.error.set(null);
        this.isParsing.set(true);
        this.progress.set({ processedBytes: 0, totalBytes: file.size, percent: 0 });
        this.summary.set({ lines: 0, jsonObjects: 0 });

        // init worker
        this.worker?.terminate();
        this.worker = new Worker(new URL('../workers/parse-logs.worker', import.meta.url), { type: 'module' });

        this.worker.onmessage = (ev: MessageEvent) => {
            const msg = ev.data as WorkerMessage;
            if (msg.type === 'progress') {
                this.progress.set(msg.progress);
            } else if (msg.type === 'summary') {
                this.summary.set(msg.summary);
            } else if (msg.type === 'done') {
                this.isParsing.set(false);
            } else if (msg.type === 'error') {
                this.error.set(msg.error);
                this.isParsing.set(false);
            }
        };

        const startMsg: WorkerStartMessage = {
            type: 'start',
            file,
            chunkSize,
        };
        this.worker.postMessage(startMsg);
    }

    reset(): void {
        this.worker?.terminate();
        this.worker = null;
        this.progress.set(null);
        this.summary.set(null);
        this.error.set(null);
        this.isParsing.set(false);
    }
}

export type WorkerStartMessage = {
    type: 'start';
    file: File;
    chunkSize: number;
};

export type WorkerMessage =
  | { type: 'progress'; progress: ParseProgress }
  | { type: 'summary'; summary: ParseSummary }
  | { type: 'done' }
  | { type: 'error'; error: string };

