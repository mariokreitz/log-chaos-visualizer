import type { ParsedLogEntry } from '../types/file-parse.types';
import type { NormalizedLogEntry } from '../types/log-entries';

/**
 * Extract a field value from a parsed log entry using its normalized structure.
 * This provides consistent field access regardless of the original log format.
 *
 * @param entry - The parsed log entry
 * @param fieldName - The field name to extract (as documented in HelpMe)
 * @returns The field value or null if not found
 */
export function extractFieldValue(entry: ParsedLogEntry, fieldName: string): string | number | boolean | null {
  // TODO: Will be implemented once ParsedLogEntry includes normalized field
  // For now, use the legacy extraction logic

  // Common fields that should be on normalized entry
  switch (fieldName) {
    case 'kind':
      return entry.kind;
    default:
      return extractFromRawEntry(entry, fieldName);
  }
}

/**
 * Extract field value from raw entry (legacy support)
 * This is a temporary function until normalization is fully implemented
 */
function extractFromRawEntry(entry: ParsedLogEntry, fieldName: string): string | number | boolean | null {
  try {
    switch (entry.kind) {
      case 'pino': {
        const pino = entry.entry;
        switch (fieldName) {
          case 'message':
          case 'msg':
            return pino.msg;
          case 'timestamp':
          case 'time':
            return pino.time;
          case 'hostname':
            return pino.hostname;
          case 'pid':
            return pino.pid;
          case 'name':
            return pino.name ?? null;
          case 'method':
            return pino.req?.method ?? null;
          case 'url':
            return pino.req?.url ?? null;
          case 'statusCode':
            return pino.res?.statusCode ?? null;
          case 'responseTime':
            return pino.res?.responseTimeMs ?? null;
          case 'requestId':
            return pino.req?.id ?? null;
          default:
            // Try dynamic field access
            return (pino as Record<string, unknown>)[fieldName] as string | number | boolean | null;
        }
      }

      case 'winston': {
        const winston = entry.entry;
        switch (fieldName) {
          case 'message':
            return winston.message;
          case 'timestamp':
            return Date.parse(winston.timestamp);
          case 'requestId':
            return (winston.meta?.requestId as string) ?? null;
          case 'userId':
            return (winston.meta?.userId as string | number) ?? null;
          case 'traceId':
            return (winston.meta?.traceId as string) ?? null;
          default:
            // Try dynamic field access
            return (winston as Record<string, unknown>)[fieldName] as string | number | boolean | null;
        }
      }

      case 'loki': {
        const loki = entry.entry;
        switch (fieldName) {
          case 'message':
          case 'line':
            return loki.line;
          case 'timestamp':
          case 'ts':
            return Date.parse(loki.ts);
          case 'job':
            return loki.labels?.job ?? null;
          case 'instance':
            return loki.labels?.instance ?? null;
          case 'app':
            return loki.labels?.app ?? null;
          case 'environment':
            return loki.labels?.environment ?? null;
          default:
            // Try labels
            if (loki.labels && fieldName in loki.labels) {
              return loki.labels[fieldName] ?? null;
            }
            return null;
        }
      }

      case 'docker': {
        const docker = entry.entry;
        switch (fieldName) {
          case 'message':
          case 'log':
            return docker.log;
          case 'timestamp':
          case 'time':
            return Date.parse(docker.time);
          case 'stream':
            return docker.stream;
          default:
            return null;
        }
      }

      case 'promtail': {
        const promtail = entry.entry;
        switch (fieldName) {
          case 'message':
            return promtail.message;
          case 'timestamp':
          case 'ts':
            return Date.parse(promtail.ts);
          case 'level':
            return promtail.level;
          default:
            return null;
        }
      }

      case 'text': {
        const text = entry.entry;
        switch (fieldName) {
          case 'message':
          case 'line':
            return text.line;
          default:
            return null;
        }
      }

      case 'unknown-json': {
        const raw = entry.entry as Record<string, unknown>;
        const value = raw[fieldName];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return value;
        }
        return null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Type guard for checking if a log entry is of a specific kind
 */
export function isLogKind<K extends ParsedLogEntry['kind']>(
  entry: ParsedLogEntry,
  kind: K,
): entry is Extract<ParsedLogEntry, { kind: K }> {
  return entry.kind === kind;
}

/**
 * Extract field value from a normalized log entry
 * This will be the primary extraction function once normalization is complete
 */
export function extractFromNormalized(
  normalized: NormalizedLogEntry,
  fieldName: string,
): string | number | boolean | null {
  // Common fields
  switch (fieldName) {
    case 'level':
      return normalized.level;
    case 'message':
      return normalized.message;
    case 'timestamp':
      return normalized.timestamp;
    case 'environment':
      return normalized.environment;
    case 'kind':
      return normalized.kind;
    case 'hostname':
      return normalized.hostname ?? null;
  }

  // Pino fields
  if (fieldName === 'msg') return normalized.pino?.msg ?? null;
  if (fieldName === 'time') return normalized.pino?.time ?? null;
  if (fieldName === 'pid') return normalized.pino?.pid ?? null;
  if (fieldName === 'name') return normalized.pino?.name ?? null;

  // HTTP fields
  if (fieldName === 'method') return normalized.http?.method ?? null;
  if (fieldName === 'url') return normalized.http?.url ?? null;
  if (fieldName === 'statusCode') return normalized.http?.statusCode ?? null;
  if (fieldName === 'responseTime') return normalized.http?.responseTime ?? null;

  // Winston fields
  if (fieldName === 'requestId') {
    return normalized.winston?.requestId ?? normalized.http?.requestId ?? null;
  }
  if (fieldName === 'userId') return normalized.winston?.userId ?? null;
  if (fieldName === 'traceId') return normalized.winston?.traceId ?? null;

  // Loki fields
  if (fieldName === 'line') return normalized.loki?.line ?? null;
  if (fieldName === 'job') return normalized.loki?.job ?? null;
  if (fieldName === 'instance') return normalized.loki?.instance ?? null;
  if (fieldName === 'app') return normalized.loki?.app ?? null;

  // Docker fields
  if (fieldName === 'log') return normalized.docker?.log ?? null;
  if (fieldName === 'stream') return normalized.docker?.stream ?? null;

  // Promtail fields
  if (fieldName === 'ts') return normalized.promtail?.ts ?? null;

  // Try to extract from meta or raw entry
  if (normalized.meta?.[fieldName]) {
    const value = normalized.meta[fieldName];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
  }

  // Try raw entry as last resort
  const raw = normalized.raw as Record<string, unknown>;
  const value = raw?.[fieldName];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return null;
}
