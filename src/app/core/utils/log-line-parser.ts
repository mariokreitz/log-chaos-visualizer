import type { ParsedKind, ParsedLogEntry } from '../types/file-parse.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../types/log-entries';
import { isDockerLogLine, isLokiEntry, isPinoEntry, isPromtailTextLine, isWinstonEntry } from './log-format-guards';
import { normalizeLogEntry } from './log-normalizer';
import { computeSearchText } from './search-utils';

export function parseJsonObject(candidate: unknown): ParsedLogEntry {
  let kind: ParsedKind;
  let entry: PinoEntry | WinstonEntry | LokiEntry | DockerLogLine | PromtailTextLine | unknown;

  if (isPinoEntry(candidate)) {
    kind = 'pino';
    entry = candidate;
  } else if (isDockerLogLine(candidate)) {
    kind = 'docker';
    entry = candidate;
  } else if (isPromtailTextLine(candidate)) {
    kind = 'promtail';
    entry = candidate;
  } else if (isWinstonEntry(candidate)) {
    kind = 'winston';
    entry = candidate;
  } else if (isLokiEntry(candidate)) {
    kind = 'loki';
    entry = candidate;
  } else {
    kind = 'unknown-json';
    entry = candidate;
  }

  const normalized = normalizeLogEntry(kind, entry);
  const parsed: ParsedLogEntry = { kind, entry, normalized } as ParsedLogEntry;
  // attach lightweight search text
  (parsed as ParsedLogEntry & { searchText?: string }).searchText = computeSearchText(parsed);
  return parsed;
}

export function parseTextLine(line: string): ParsedLogEntry {
  const trimmed = line.trim();
  const entry = { line: trimmed };
  const normalized = normalizeLogEntry('text', entry);
  const parsed: ParsedLogEntry = { kind: 'text', entry, normalized } as ParsedLogEntry;
  (parsed as ParsedLogEntry & { searchText?: string }).searchText = computeSearchText(parsed);
  return parsed;
}
