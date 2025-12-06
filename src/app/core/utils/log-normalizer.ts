import type { NormalizedEnvironment, NormalizedLogLevel, ParsedKind } from '../types/file-parse.types';
import type {
  DockerLogLine,
  LokiEntry,
  NormalizedLogEntry,
  PinoEntry,
  PromtailTextLine,
  WinstonEntry,
} from '../types/log-entries';

/**
 * Normalize a log entry to a unified structure regardless of its original format.
 * This provides consistent field access across all log formats.
 */
export function normalizeLogEntry(
  kind: ParsedKind,
  entry: PinoEntry | WinstonEntry | LokiEntry | DockerLogLine | PromtailTextLine | { line: string } | unknown,
): NormalizedLogEntry {
  const normalized: NormalizedLogEntry = {
    kind,
    level: 'unknown',
    message: '',
    timestamp: null,
    environment: 'unknown',
    raw: entry,
  };

  switch (kind) {
    case 'pino':
      return normalizePino(entry as PinoEntry, normalized);
    case 'winston':
      return normalizeWinston(entry as WinstonEntry, normalized);
    case 'loki':
      return normalizeLoki(entry as LokiEntry, normalized);
    case 'docker':
      return normalizeDocker(entry as DockerLogLine, normalized);
    case 'promtail':
      return normalizePromtail(entry as PromtailTextLine, normalized);
    case 'text':
      return normalizeText(entry as { line: string }, normalized);
    case 'unknown-json':
    default:
      return normalizeUnknownJson(entry as Record<string, unknown>, normalized);
  }
}

function normalizePino(pino: PinoEntry, normalized: NormalizedLogEntry): NormalizedLogEntry {
  normalized.level = normalizePinoLevel(pino.level);
  normalized.message = pino.msg || '';
  normalized.timestamp = pino.time || null;
  normalized.hostname = pino.hostname;
  normalized.environment = detectEnvironment(pino);

  normalized.pino = {
    pid: pino.pid,
    name: pino.name,
    time: pino.time,
    msg: pino.msg,
  };

  // Extract HTTP fields if present
  if (pino.req || pino.res) {
    normalized.http = {
      method: pino.req?.method,
      url: pino.req?.url,
      statusCode: pino.res?.statusCode,
      responseTime: pino.res?.responseTimeMs,
      requestId: pino.req?.id,
    };
  }

  return normalized;
}

function normalizeWinston(winston: WinstonEntry, normalized: NormalizedLogEntry): NormalizedLogEntry {
  normalized.level = normalizeWinstonLevel(winston.level);
  normalized.message = winston.message || '';
  normalized.timestamp = Date.parse(winston.timestamp);
  normalized.environment = detectEnvironment(winston);

  if (winston.meta) {
    normalized.winston = {
      requestId: winston.meta.requestId as string | undefined,
      userId: winston.meta.userId,
      traceId: winston.meta.traceId as string | undefined,
    };

    // Also populate http fields if metadata contains them
    if (winston.meta.requestId || winston.meta.userId) {
      normalized.http = {
        requestId: winston.meta.requestId as string | undefined,
      };
    }
  }

  return normalized;
}

function normalizeLoki(loki: LokiEntry, normalized: NormalizedLogEntry): NormalizedLogEntry {
  normalized.message = loki.line || '';
  normalized.timestamp = Date.parse(loki.ts);
  normalized.environment = (loki.labels?.environment as NormalizedEnvironment) || 'unknown';
  normalized.level = detectLokiLevel(loki.line);

  normalized.loki = {
    line: loki.line,
    labels: loki.labels as Record<string, string>,
    job: loki.labels?.job,
    instance: loki.labels?.instance,
    app: loki.labels?.app,
  };

  return normalized;
}

function normalizeDocker(docker: DockerLogLine, normalized: NormalizedLogEntry): NormalizedLogEntry {
  normalized.message = docker.log || '';
  normalized.timestamp = Date.parse(docker.time);
  normalized.level = detectDockerLevel(docker.log);
  normalized.environment = detectEnvironment(docker);

  normalized.docker = {
    log: docker.log,
    stream: docker.stream,
  };

  return normalized;
}

function normalizePromtail(promtail: PromtailTextLine, normalized: NormalizedLogEntry): NormalizedLogEntry {
  normalized.message = promtail.message || '';
  normalized.timestamp = Date.parse(promtail.ts);
  normalized.level = promtail.level as NormalizedLogLevel;
  normalized.environment = detectEnvironment(promtail);

  normalized.promtail = {
    ts: promtail.ts,
  };

  return normalized;
}

function normalizeText(text: { line: string }, normalized: NormalizedLogEntry): NormalizedLogEntry {
  normalized.message = text.line || '';
  normalized.level = detectTextLevel(text.line);
  normalized.environment = detectEnvironment(text);

  return normalized;
}

function normalizeUnknownJson(generic: Record<string, unknown>, normalized: NormalizedLogEntry): NormalizedLogEntry {
  normalized.message = extractGenericMessage(generic);
  normalized.timestamp = extractGenericTimestamp(generic);
  normalized.level = detectGenericLevel(generic);
  normalized.environment = detectEnvironment(generic);
  normalized.meta = generic;

  return normalized;
}

// Level normalization functions

function normalizePinoLevel(pinoLevel: number): NormalizedLogLevel {
  switch (pinoLevel) {
    case 10:
      return 'trace';
    case 20:
      return 'debug';
    case 30:
      return 'info';
    case 40:
      return 'warn';
    case 50:
      return 'error';
    case 60:
      return 'fatal';
    default:
      return 'unknown';
  }
}

function normalizeWinstonLevel(winstonLevel: string): NormalizedLogLevel {
  switch (winstonLevel) {
    case 'silly':
    case 'verbose':
    case 'debug':
      return 'debug';
    case 'info':
      return 'info';
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    default:
      return 'unknown';
  }
}

function detectLokiLevel(line: string): NormalizedLogLevel {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('err')) return 'error';
  if (lower.includes('warn') || lower.includes('warning')) return 'warn';
  if (lower.includes('info')) return 'info';
  if (lower.includes('debug')) return 'debug';
  if (lower.includes('trace')) return 'trace';
  if (lower.includes('fatal') || lower.includes('panic')) return 'fatal';
  return 'unknown';
}

function detectDockerLevel(log: string): NormalizedLogLevel {
  const lower = log.toLowerCase();
  if (lower.includes('error') || lower.includes('err')) return 'error';
  if (lower.includes('warn') || lower.includes('warning')) return 'warn';
  if (lower.includes('info')) return 'info';
  if (lower.includes('debug')) return 'debug';
  if (lower.includes('trace')) return 'trace';
  if (lower.includes('fatal') || lower.includes('panic')) return 'fatal';
  return 'unknown';
}

function detectTextLevel(line: string): NormalizedLogLevel {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('err')) return 'error';
  if (lower.includes('warn') || lower.includes('warning')) return 'warn';
  if (lower.includes('info')) return 'info';
  if (lower.includes('debug')) return 'debug';
  if (lower.includes('trace')) return 'trace';
  if (lower.includes('fatal') || lower.includes('panic')) return 'fatal';
  return 'unknown';
}

function detectGenericLevel(obj: Record<string, unknown>): NormalizedLogLevel {
  const level = obj['level'] || obj['severity'] || obj['log_level'];
  if (typeof level === 'string') {
    return normalizeWinstonLevel(level);
  }
  return 'unknown';
}

// Environment detection

function detectEnvironment(
  entry:
    | PinoEntry
    | WinstonEntry
    | LokiEntry
    | DockerLogLine
    | PromtailTextLine
    | { line: string }
    | Record<string, unknown>,
): NormalizedEnvironment {
  // Check Pino entry
  if ('hostname' in entry && typeof entry.hostname === 'string') {
    const host = entry.hostname.toLowerCase();
    if (host.includes('prod')) return 'prod';
    if (host.includes('staging')) return 'staging';
    if (host.includes('dev')) return 'dev';
  }

  // Check Loki labels
  if ('labels' in entry && entry.labels && typeof entry.labels === 'object') {
    const labels = entry.labels as Record<string, string>;
    const env = labels['environment'];
    if (env === 'prod' || env === 'staging' || env === 'dev') return env;
  }

  // Check generic meta
  if ('meta' in entry && entry.meta && typeof entry.meta === 'object') {
    const meta = entry.meta as Record<string, unknown>;
    const envMeta = meta['environment'];
    if (envMeta === 'prod' || envMeta === 'staging' || envMeta === 'dev') {
      return envMeta as NormalizedEnvironment;
    }
  }

  // Check generic fields
  if (typeof entry === 'object' && entry !== null) {
    const generic = entry as Record<string, unknown>;
    const env = generic['environment'] || generic['env'] || generic['NODE_ENV'];
    if (typeof env === 'string') {
      const envLower = env.toLowerCase();
      if (envLower.includes('prod')) return 'prod';
      if (envLower.includes('staging')) return 'staging';
      if (envLower.includes('dev')) return 'dev';
    }
  }

  return 'unknown';
}

// Message extraction helpers

function extractGenericMessage(obj: Record<string, unknown>): string {
  // Try common message field names
  const message = obj['message'] || obj['msg'] || obj['text'] || obj['line'] || obj['log'];
  if (typeof message === 'string') return message;

  // Fall back to stringifying the whole object if needed
  try {
    return JSON.stringify(obj).substring(0, 200);
  } catch {
    return '';
  }
}

function extractGenericTimestamp(obj: Record<string, unknown>): number | null {
  const ts = obj['timestamp'] || obj['ts'] || obj['time'] || obj['date'];

  if (typeof ts === 'number') {
    // If it's a large number (milliseconds), use as-is
    if (ts > 1e10) return ts;
    // If it's a smaller number (seconds), convert to milliseconds
    if (ts > 1e9) return ts * 1000;
    return ts;
  }

  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return !isNaN(parsed) ? parsed : null;
  }

  return null;
}
