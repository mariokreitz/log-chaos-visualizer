export interface DockerLogLine {
  log: string;
  stream: 'stdout' | 'stderr';
  time: string;
}

export interface LokiEntry {
  ts: string;
  labels: {
    job?: string;
    instance?: string;
    app?: string;
    environment?: 'dev' | 'staging' | 'prod';
    [k: string]: string | undefined;
  };
  line: string;
}

export interface PinoEntry {
  time: number; // epoch millis
  level: 10 | 20 | 30 | 40 | 50 | 60; // trace/debug/info/warn/error/fatal
  pid: number;
  hostname: string;
  name?: string;
  msg: string;
  req?: {
    id?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
    url?: string;
    remoteAddress?: string;
  };
  res?: {
    statusCode?: number;
    responseTimeMs?: number;
  };
  meta?: Record<string, unknown>;
  // Allow for additional dynamic fields
  [key: string]: unknown;
}

export interface WinstonEntry {
  timestamp: string; // ISO
  level: 'silly' | 'debug' | 'verbose' | 'info' | 'warn' | 'error';
  message: string;
  meta?: {
    requestId?: string;
    userId?: string | number;
    traceId?: string;
    [k: string]: unknown;
  };
  // Allow for additional dynamic fields
  [key: string]: unknown;
}

export interface PromtailTextLine {
  ts: string; // ISO timestamp
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string; // text message with key=value pairs
}

/**
 * Normalized log entry - a unified structure that all log formats are transformed into.
 * This provides consistent field access regardless of the original log format.
 *
 * All fields documented in the HelpMe query reference are accessible through this structure.
 */
export interface NormalizedLogEntry {
  // Core fields (always present after normalization)
  kind: 'pino' | 'winston' | 'loki' | 'docker' | 'promtail' | 'text' | 'unknown-json';
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown';
  message: string;
  timestamp: number | null; // epoch milliseconds, null if unavailable
  environment: 'dev' | 'staging' | 'prod' | 'unknown';

  // Optional common fields
  hostname?: string;

  // Pino-specific fields
  pino?: {
    pid?: number;
    name?: string;
    time?: number;
    msg?: string;
  };

  // HTTP request/response fields (from Pino or Winston)
  http?: {
    method?: string;
    url?: string;
    statusCode?: number;
    responseTime?: number;
    requestId?: string;
  };

  // Winston-specific fields
  winston?: {
    requestId?: string;
    userId?: string | number;
    traceId?: string;
  };

  // Loki-specific fields
  loki?: {
    line?: string;
    labels?: Record<string, string>;
    job?: string;
    instance?: string;
    app?: string;
  };

  // Docker-specific fields
  docker?: {
    log?: string;
    stream?: 'stdout' | 'stderr';
  };

  // Promtail-specific fields
  promtail?: {
    ts?: string;
  };

  // Generic metadata for unknown formats
  meta?: Record<string, unknown>;

  // Original raw entry for reference
  raw: PinoEntry | WinstonEntry | LokiEntry | DockerLogLine | PromtailTextLine | { line: string } | unknown;
}
