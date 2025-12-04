import { inject, Injectable, signal } from '@angular/core';
import type { ParsingSpeed } from '../../shared/config/settings-config.types';
import { APP_CONFIG } from '../config/app-config';
import type {
    EnvironmentSummary,
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

@Injectable({ providedIn: 'root' })
export class FileParseService {
    readonly selectedFile = signal<File | null>(null);
    readonly progress = signal<ParseProgress | null>(null);
    readonly summary = signal<ExtendedParseSummary | null>(null);
    readonly error = signal<string | null>(null);
    readonly isParsing = signal(false);
    readonly latestBatch = signal<ParsedBatch | null>(null);

    private worker: Worker | null = null;
    private readonly notifications = inject(NotificationService);
    private readonly settings = inject(SettingsService);

    setFile(file: File | null): void {
        this.reset();
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
        });
        this.latestBatch.set(null);

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
                    };

                    for (const entry of msg.batch.entries) {
                        updated.counts[entry.kind] = (updated.counts[entry.kind] ?? 0) + 1;

                        const level = normalizeLogLevel(entry);
                        updated.levelSummary.total += 1;
                        updated.levelSummary.byLevel[level] =
                          (updated.levelSummary.byLevel[level] ?? 0) + 1;

                        const env = normalizeEnvironment(entry);
                        updated.environmentSummary.total += 1;
                        updated.environmentSummary.byEnvironment[env] =
                          (updated.environmentSummary.byEnvironment[env] ?? 0) + 1;
                    }

                    this.summary.set(updated);
                }
            } else if (msg.type === 'summary') {
                // The worker currently only computes legacy summary fields.
                // We keep our richer, incrementally built summary and ignore the worker one,
                // except for ensuring totalLines/malformedCount stay in sync.
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
        this.progress.set(null);
        this.summary.set(null);
        this.error.set(null);
        this.isParsing.set(false);
        this.latestBatch.set(null);
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

    return 'unknown';
}

function normalizeEnvironment(entry: ParsedLogEntry): NormalizedEnvironment {
    if (entry.kind === 'loki') {
        const env = entry.entry.labels.environment;
        if (env === 'dev' || env === 'staging' || env === 'prod') {
            return env;
        }
    }
    return 'unknown';
}
