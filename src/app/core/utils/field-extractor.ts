import type { ParsedLogEntry } from '../types/file-parse.types';
import type { NormalizedLogEntry } from '../types/log-entries';

/**
 * Extract a field value from a parsed log entry using its normalized structure.
 * Supports dot notation for nested fields (e.g., 'res.statusCode').
 *
 * @param entry - The parsed log entry
 * @param fieldName - The field name to extract (dot notation supported)
 * @returns The field value or null if not found
 */
export function extractFieldValue(entry: ParsedLogEntry, fieldName: string): string | number | boolean | null {
  // Use normalized structure if available
  if ('normalized' in entry && entry.normalized) {
    // Try direct field first
    const normalizedValue = extractFromNormalized(entry.normalized, fieldName);
    if (normalizedValue !== null && normalizedValue !== undefined) return normalizedValue;
    // Try aliases for flat field names in normalized
    const aliasPaths = FIELD_ALIASES[fieldName];
    if (aliasPaths) {
      for (const path of aliasPaths) {
        const aliasValue = extractFromNormalized(entry.normalized, path);
        if (aliasValue !== null && aliasValue !== undefined) return aliasValue;
      }
    }
  }

  // Try aliases for flat field names in raw entry
  const aliasPaths = FIELD_ALIASES[fieldName];
  if (aliasPaths) {
    for (const path of aliasPaths) {
      const value = extractFromRawEntryDot(entry, path);
      if (value !== null && value !== undefined) return value;
    }
  }

  // Fallback to raw entry extraction (legacy support)
  return extractFromRawEntryDot(entry, fieldName);
}

/**
 * Extract field value from raw entry (legacy support), supporting dot notation
 */
function extractFromRawEntryDot(entry: ParsedLogEntry, fieldName: string): string | number | boolean | null {
  // Support dot notation for nested fields
  const path = fieldName.split('.');
  let value: unknown;
  switch (entry.kind) {
    case 'pino':
      value = entry.entry;
      break;
    case 'winston':
      value = entry.entry;
      break;
    case 'loki':
      value = entry.entry;
      break;
    default:
      value = entry.entry;
  }
  for (const key of path) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }
  // Only return primitive values
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return null;
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
  if (normalized.meta?.[fieldName] !== undefined) {
    const value = normalized.meta[fieldName];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
  }

  // Try raw entry as last resort
  const raw = normalized.raw as Record<string, unknown>;
  if (raw && raw[fieldName] !== undefined) {
    const value = raw[fieldName];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
  }

  // Fallback: support dot notation for nested fields in normalized, meta, and raw
  const dotValue =
    extractFromObjectByPath(normalized, fieldName) ??
    (normalized.meta ? extractFromObjectByPath(normalized.meta, fieldName) : null) ??
    (raw ? extractFromObjectByPath(raw, fieldName) : null);
  if (typeof dotValue === 'string' || typeof dotValue === 'number' || typeof dotValue === 'boolean') {
    return dotValue;
  }

  return null;
}

/**
 * Helper to extract a value from an object using dot notation (e.g., 'http.statusCode')
 */
function extractFromObjectByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return null;
  const parts = path.split('.');
  let value: unknown = obj;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return value;
}

/**
 * Map flat field names to possible nested paths for extraction.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  statusCode: ['http.statusCode', 'res.statusCode', 'meta.statusCode', 'statusCode'],
  responseTime: ['http.responseTime', 'res.responseTimeMs', 'meta.responseTime', 'responseTime'],
  hostname: ['hostname', 'meta.hostname'],
  environment: ['meta.environment', 'environment'],
  userId: ['meta.userId', 'userId'],
  traceId: ['meta.traceId', 'traceId'],
  spanId: ['meta.spanId', 'spanId'],
  message: ['msg', 'message'],
  // Add more aliases as needed
};
