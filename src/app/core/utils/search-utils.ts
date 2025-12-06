import type { ParsedLogEntry } from '../types/file-parse.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../types/log-entries';

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

export function formatSourceForIndex(parsed: ParsedLogEntry): string {
  try {
    switch (parsed.kind) {
      case 'pino': {
        const e = parsed.entry as PinoEntry & Record<string, unknown>;
        const pid = safeString(e.pid);
        const host = safeString(e.hostname);
        const name = safeString(e.name);
        const combined = `${pid}${host ? '@' + host : ''}${name ? ' (' + name + ')' : ''}`.trim();
        return combined.toLowerCase();
      }
      case 'winston': {
        const e = parsed.entry as WinstonEntry & Record<string, unknown>;
        const meta = (e.meta as Record<string, unknown>) || {};
        return (
          safeString(meta['requestId']) ||
          safeString(meta['userId']) ||
          safeString(meta['traceId'])
        ).toLowerCase();
      }
      case 'loki': {
        const e = parsed.entry as LokiEntry & Record<string, unknown>;
        return safeString((e.labels as Record<string, unknown> | undefined)?.['job']).toLowerCase();
      }
      case 'docker': {
        const e = parsed.entry as DockerLogLine & Record<string, unknown>;
        return safeString(e.stream).toLowerCase();
      }
      case 'promtail':
      case 'text':
      case 'unknown-json':
      default:
        return '';
    }
  } catch {
    return '';
  }
}

export function getNormalizedLevel(parsed: ParsedLogEntry): string {
  try {
    switch (parsed.kind) {
      case 'pino': {
        const lvl = (parsed.entry as PinoEntry & Record<string, unknown>).level as unknown;
        if (typeof lvl === 'number') {
          if (lvl === 10) return 'trace';
          if (lvl === 20) return 'debug';
          if (lvl === 30) return 'info';
          if (lvl === 40) return 'warn';
          if (lvl === 50) return 'error';
          if (lvl === 60) return 'fatal';
        }
        return 'unknown';
      }
      case 'winston': {
        const lvl = (parsed.entry as WinstonEntry & Record<string, unknown>).level as unknown;
        if (typeof lvl === 'string') {
          const l = (lvl as string).toLowerCase();
          if (l === 'silly' || l === 'verbose') return 'trace';
          if (l === 'debug') return 'debug';
          if (l === 'info') return 'info';
          if (l === 'warn') return 'warn';
          if (l === 'error') return 'error';
        }
        return 'unknown';
      }
      case 'promtail': {
        const lvl = (parsed.entry as PromtailTextLine & Record<string, unknown>).level as unknown;
        if (typeof lvl === 'string') {
          const l = (lvl as string).toLowerCase();
          if (l === 'debug' || l === 'info' || l === 'warn' || l === 'error') return l;
        }
        return 'unknown';
      }
      case 'loki': {
        const lvl = (parsed.entry as LokiEntry & Record<string, unknown>).labels?.['level'];
        if (typeof lvl === 'string') return lvl.toLowerCase();
        return 'unknown';
      }
      case 'docker': {
        try {
          const e = parsed.entry as DockerLogLine & Record<string, unknown>;
          const stream = String(e.stream ?? '').toLowerCase();
          if (stream === 'stderr') return 'error';
          if (stream === 'stdout') return 'info';
          const log = safeString(e.log);
          const m = /level=(trace|debug|info|warn|error|fatal)\b/i.exec(log);
          if (m) return m[1].toLowerCase();
        } catch {
          // ignore
        }
        return 'unknown';
      }
      case 'text': {
        const textEntry = parsed.entry as unknown as { line?: string };
        const line = String(textEntry.line ?? '');
        const firstToken = line.split(/\s+/, 1)[0];
        const upperToken = String(firstToken).toUpperCase();
        if (upperToken === 'TRACE') return 'trace';
        if (upperToken === 'DEBUG') return 'debug';
        if (upperToken === 'INFO') return 'info';
        if (upperToken === 'WARN') return 'warn';
        if (upperToken === 'ERROR') return 'error';
        if (upperToken === 'FATAL') return 'fatal';
        return 'unknown';
      }
      case 'unknown-json':
      default: {
        try {
          const obj = parsed.entry as Record<string, unknown> | undefined;
          if (obj) {
            const candidate = (obj['level'] ?? obj['logLevel'] ?? obj['lvl'] ?? obj['severity']) as unknown;
            if (typeof candidate === 'string') {
              const lc = candidate.toLowerCase();
              if (lc.includes('trace')) return 'trace';
              if (lc.includes('debug')) return 'debug';
              if (lc.includes('info')) return 'info';
              if (lc.includes('warn')) return 'warn';
              if (lc.includes('error')) return 'error';
              if (lc.includes('fatal')) return 'fatal';
            }
          }
        } catch {
          // ignore
        }
        return 'unknown';
      }
    }
  } catch {
    return 'unknown';
  }
}

export function getNormalizedEnvironment(parsed: ParsedLogEntry): string {
  try {
    switch (parsed.kind) {
      case 'loki': {
        const env = (parsed.entry as LokiEntry & Record<string, unknown>).labels?.['environment'];
        if (env === 'dev' || env === 'staging' || env === 'prod') return env;
        return 'unknown';
      }
      case 'pino': {
        const meta = (parsed.entry as PinoEntry & Record<string, unknown>).meta as Record<string, unknown> | undefined;
        const env = meta ? meta['environment'] : undefined;
        if (env === 'dev' || env === 'staging' || env === 'prod') return env as string;
        return 'unknown';
      }
      case 'winston': {
        const meta = (parsed.entry as WinstonEntry & Record<string, unknown>).meta as
          | Record<string, unknown>
          | undefined;
        const env = meta ? meta['environment'] : undefined;
        if (env === 'dev' || env === 'staging' || env === 'prod') return env as string;
        return 'unknown';
      }
      case 'promtail': {
        const anyE = parsed.entry as unknown as { environment?: string };
        if (anyE && (anyE.environment === 'dev' || anyE.environment === 'staging' || anyE.environment === 'prod'))
          return anyE.environment as string;
        return 'unknown';
      }
      case 'docker': {
        const log = safeString((parsed.entry as DockerLogLine & Record<string, unknown>).log ?? '');
        const m = /env=(dev|staging|prod)\b/i.exec(log);
        if (m) return m[1].toLowerCase();
        return 'unknown';
      }
      case 'text': {
        const textEntry = parsed.entry as unknown as { line?: string };
        const line = String(textEntry.line ?? '');
        const m = /env=(dev|staging|prod)\b/i.exec(line);
        if (m) return m[1].toLowerCase();
        return 'unknown';
      }
      case 'unknown-json':
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

function timestampTokens(parsed: ParsedLogEntry): string[] {
  try {
    const tokens: string[] = [];
    if (parsed.kind === 'pino') {
      const ms = (parsed.entry as PinoEntry & Record<string, unknown>).time as unknown;
      if (typeof ms === 'number' && Number.isFinite(ms)) {
        tokens.push(String(ms));
        const iso = new Date(ms).toISOString();
        tokens.push(iso);
      }
      return tokens;
    }

    if (parsed.kind === 'winston') {
      const ts = (parsed.entry as WinstonEntry & Record<string, unknown>).timestamp as unknown;
      if (typeof ts === 'string') {
        tokens.push(ts);
        const ms = Date.parse(ts);
        if (!Number.isNaN(ms)) tokens.push(new Date(ms).toISOString());
      }
      return tokens;
    }

    if (parsed.kind === 'loki' || parsed.kind === 'promtail') {
      const entryWithTs = parsed.entry as unknown as { ts?: string };
      const ts = entryWithTs.ts;
      if (typeof ts === 'string') {
        tokens.push(ts);
        const ms = Date.parse(ts);
        if (!Number.isNaN(ms)) tokens.push(new Date(ms).toISOString());
      }
      return tokens;
    }

    if (parsed.kind === 'docker') {
      const dockerEntry = parsed.entry as unknown as { time?: string };
      const ts = dockerEntry.time;
      if (typeof ts === 'string') {
        tokens.push(ts);
        const ms = Date.parse(ts);
        if (!Number.isNaN(ms)) tokens.push(new Date(ms).toISOString());
      }
      return tokens;
    }

    return [];
  } catch {
    return [];
  }
}

export function computeSearchText(parsed: ParsedLogEntry): string {
  const parts: string[] = [];
  parts.push(safeString(parsed.kind));

  switch (parsed.kind) {
    case 'pino': {
      const e = parsed.entry as PinoEntry & Record<string, unknown>;
      parts.push(safeString(e.msg));
      parts.push(safeString(e.hostname));
      parts.push(safeString(e.pid));
      parts.push(safeString(e.name));
      break;
    }
    case 'winston': {
      const e = parsed.entry as WinstonEntry & Record<string, unknown>;
      const meta = e.meta as unknown as Record<string, unknown> | undefined;
      parts.push(safeString(e.message));
      parts.push(safeString(e.level));
      parts.push(safeString(meta?.['requestId']));
      parts.push(safeString(meta?.['userId']));
      break;
    }
    case 'loki': {
      const e = parsed.entry as LokiEntry & Record<string, unknown>;
      const labels = e.labels as unknown as Record<string, unknown> | undefined;
      parts.push(safeString(e.line));
      parts.push(safeString(labels?.['job']));
      parts.push(safeString(labels?.['level']));
      break;
    }
    case 'promtail': {
      const e = parsed.entry as PromtailTextLine & Record<string, unknown>;
      parts.push(safeString(e.message));
      parts.push(safeString(e.level));
      break;
    }
    case 'docker': {
      const e = parsed.entry as DockerLogLine & Record<string, unknown>;
      parts.push(safeString(e.log));
      parts.push(safeString(e.stream));
      break;
    }
    case 'text': {
      const textEntry = parsed.entry as unknown as { line?: string };
      parts.push(safeString(textEntry.line));
      break;
    }
    case 'unknown-json':
    default: {
      try {
        parts.push(JSON.stringify(parsed.entry));
      } catch {
        parts.push(safeString(parsed.entry));
      }
      break;
    }
  }

  // timestamps
  parts.push(...timestampTokens(parsed));

  // source formatted like UI
  const src = formatSourceForIndex(parsed);
  if (src) parts.push(src);

  // normalized level and env
  const lvl = getNormalizedLevel(parsed);
  const env = getNormalizedEnvironment(parsed);
  if (lvl && lvl !== 'unknown') {
    parts.push(lvl);
    parts.push(`level:${lvl}`);
  }
  if (env && env !== 'unknown') {
    parts.push(env);
    parts.push(`env:${env}`);
  }

  return parts.join(' | ').toLowerCase();
}
