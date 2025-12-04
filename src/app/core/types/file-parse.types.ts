import type { ParsingSpeed } from '../../shared/config/settings-config.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from './log-entries';

export interface ParseProgress {
  processedBytes: number;
  totalBytes: number;
  percent: number; // 0-100
}

export type ParsedKind = 'pino' | 'winston' | 'loki' | 'promtail' | 'docker' | 'unknown-json' | 'text';

export type ParsedLogEntry =
  | { kind: 'pino'; entry: PinoEntry }
  | { kind: 'winston'; entry: WinstonEntry }
  | { kind: 'loki'; entry: LokiEntry }
  | { kind: 'promtail'; entry: PromtailTextLine }
  | { kind: 'docker'; entry: DockerLogLine }
  | { kind: 'unknown-json'; entry: unknown }
  | { kind: 'text'; entry: { line: string } };

export type NormalizedLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown';

export interface LevelSummary {
  total: number;
  byLevel: Record<NormalizedLogLevel, number>;
}

export type NormalizedEnvironment = 'dev' | 'staging' | 'prod' | 'unknown';

export interface EnvironmentSummary {
  total: number;
  byEnvironment: Record<NormalizedEnvironment, number>;
}

export interface ErrorFatalTimelineBucket {
  bucketStartMs: number;
  bucketEndMs: number;
  errorCount: number;
  fatalCount: number;
  total: number;
}

export interface ErrorFatalTimelineSummary {
  bucketSizeMs: number;
  buckets: ErrorFatalTimelineBucket[];
  topPeakBucketIndices: number[];
  totalErrorCount: number;
  totalFatalCount: number;
  noTimestampErrorCount: number;
  noTimestampFatalCount: number;
}

export interface ExtendedParseSummary {
  totalLines: number;
  malformedCount: number;
  counts: Record<ParsedKind, number>;
  levelSummary: LevelSummary;
  environmentSummary: EnvironmentSummary;
  errorFatalTimeline?: ErrorFatalTimelineSummary | null;
}

export interface ParsedBatch {
  entries: ParsedLogEntry[];
  rawCount: number;
  malformedCount: number;
  chunkStartOffset: number;
  chunkEndOffset: number;
}

export interface WorkerStartMessage {
  type: 'start';
  file: File;
  chunkSize: number;
  delayMs: number;
}

export type WorkerMessage =
  | { type: 'progress'; progress: ParseProgress }
  | { type: 'batch'; batch: ParsedBatch }
  | { type: 'summary'; summary: ExtendedParseSummary }
  | { type: 'done' }
  | { type: 'error'; error: string };

export type GetParsingParametersFn = (speed: ParsingSpeed) => { chunkSize: number; delayMs: number };
