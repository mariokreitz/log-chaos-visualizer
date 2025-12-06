import type { ParsingSpeed } from '../../shared/config/settings-config.types';
import type {
  DockerLogLine,
  LokiEntry,
  NormalizedLogEntry,
  PinoEntry,
  PromtailTextLine,
  WinstonEntry,
} from './log-entries';

export interface ParseProgress {
  processedBytes: number;
  totalBytes: number;
  percent: number; // 0-100
}

export type ParsedKind = 'pino' | 'winston' | 'loki' | 'promtail' | 'docker' | 'unknown-json' | 'text';

export type ParsedLogEntry =
  | ({ kind: 'pino'; entry: PinoEntry; normalized: NormalizedLogEntry } & { searchText?: string })
  | ({ kind: 'winston'; entry: WinstonEntry; normalized: NormalizedLogEntry } & { searchText?: string })
  | ({ kind: 'loki'; entry: LokiEntry; normalized: NormalizedLogEntry } & { searchText?: string })
  | ({ kind: 'promtail'; entry: PromtailTextLine; normalized: NormalizedLogEntry } & { searchText?: string })
  | ({ kind: 'docker'; entry: DockerLogLine; normalized: NormalizedLogEntry } & { searchText?: string })
  | ({ kind: 'unknown-json'; entry: unknown; normalized: NormalizedLogEntry } & { searchText?: string })
  | ({ kind: 'text'; entry: { line: string }; normalized: NormalizedLogEntry } & { searchText?: string });

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

export interface WorkerSearchMessage {
  type: 'search';
  query: string;
}

export type WorkerMessage =
  | { type: 'progress'; progress: ParseProgress }
  | { type: 'batch'; batch: ParsedBatch }
  | { type: 'summary'; summary: ExtendedParseSummary }
  | { type: 'done' }
  | { type: 'error'; error: string }
  | { type: 'search-start'; query: string }
  | { type: 'search-result'; query: string; entries: ParsedLogEntry[] }
  | { type: 'search-error'; query: string; error: string };

export type GetParsingParametersFn = (speed: ParsingSpeed) => { chunkSize: number; delayMs: number };
