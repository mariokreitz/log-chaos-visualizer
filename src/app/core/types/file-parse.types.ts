import type { ParsingSpeed } from '../../shared/config/settings-config.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from './log-entries';

export type ParseProgress = {
    processedBytes: number;
    totalBytes: number;
    percent: number; // 0-100
};

export type ParsedKind = 'pino' | 'winston' | 'loki' | 'promtail' | 'docker' | 'unknown-json' | 'text';

export type ParsedLogEntry =
  | { kind: 'pino'; entry: PinoEntry }
  | { kind: 'winston'; entry: WinstonEntry }
  | { kind: 'loki'; entry: LokiEntry }
  | { kind: 'promtail'; entry: PromtailTextLine }
  | { kind: 'docker'; entry: DockerLogLine }
  | { kind: 'unknown-json'; entry: unknown }
  | { kind: 'text'; entry: { line: string } };

export type NormalizedLogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'unknown';

export type LevelSummary = {
    total: number;
    byLevel: Record<NormalizedLogLevel, number>;
};

export type NormalizedEnvironment = 'dev' | 'staging' | 'prod' | 'unknown';

export type EnvironmentSummary = {
    total: number;
    byEnvironment: Record<NormalizedEnvironment, number>;
};

export type ExtendedParseSummary = {
    totalLines: number;
    malformedCount: number;
    counts: Record<ParsedKind, number>;
    levelSummary: LevelSummary;
    environmentSummary: EnvironmentSummary;
};

export type ParsedBatch = {
    entries: ParsedLogEntry[];
    rawCount: number;
    malformedCount: number;
    chunkStartOffset: number;
    chunkEndOffset: number;
};

export type WorkerStartMessage = {
    type: 'start';
    file: File;
    chunkSize: number;
    delayMs: number;
};

export type WorkerMessage =
  | { type: 'progress'; progress: ParseProgress }
  | { type: 'batch'; batch: ParsedBatch }
  | { type: 'summary'; summary: ExtendedParseSummary }
  | { type: 'done' }
  | { type: 'error'; error: string };

export type GetParsingParametersFn = (speed: ParsingSpeed) => { chunkSize: number; delayMs: number };
