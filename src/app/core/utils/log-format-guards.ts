import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../types/log-entries';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPinoEntry(candidate: unknown): candidate is PinoEntry {
  if (!isRecord(candidate)) return false;
  const level = candidate['level'];
  return (
    typeof candidate['time'] === 'number' &&
    typeof level === 'number' &&
    (level === 10 || level === 20 || level === 30 || level === 40 || level === 50 || level === 60) &&
    typeof candidate['msg'] === 'string' &&
    typeof candidate['pid'] === 'number' &&
    typeof candidate['hostname'] === 'string' &&
    typeof candidate['name'] === 'string'
  );
}

export function isWinstonEntry(candidate: unknown): candidate is WinstonEntry {
  if (!isRecord(candidate)) return false;
  const level = candidate['level'];
  const message = candidate['message'];
  const timestamp = candidate['timestamp'];
  if (typeof timestamp !== 'string' || typeof message !== 'string' || typeof level !== 'string') {
    return false;
  }
  if (typeof (candidate as Record<string, unknown>)['ts'] === 'string') {
    return false;
  }
  return (
    level === 'silly' ||
    level === 'debug' ||
    level === 'verbose' ||
    level === 'info' ||
    level === 'warn' ||
    level === 'error'
  );
}

export function isLokiEntry(candidate: unknown): candidate is LokiEntry {
  if (!isRecord(candidate)) return false;
  return typeof candidate['ts'] === 'string' && isRecord(candidate['labels']) && typeof candidate['line'] === 'string';
}

export function isPromtailTextLine(candidate: unknown): candidate is PromtailTextLine {
  if (!isRecord(candidate)) return false;
  const level = candidate['level'];
  const message = candidate['message'];
  return (
    typeof candidate['ts'] === 'string' &&
    typeof message === 'string' &&
    typeof level === 'string' &&
    (level === 'debug' || level === 'info' || level === 'warn' || level === 'error')
  );
}

export function isDockerLogLine(candidate: unknown): candidate is DockerLogLine {
  if (!isRecord(candidate)) return false;
  const stream = candidate['stream'];
  return (
    typeof candidate['log'] === 'string' &&
    typeof candidate['time'] === 'string' &&
    typeof stream === 'string' &&
    (stream === 'stdout' || stream === 'stderr')
  );
}
