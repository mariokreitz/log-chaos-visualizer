import type { ParsedLogEntry } from '../types/file-parse.types';
import { getNormalizedEnvironment, getNormalizedLevel } from './search-utils';

export interface FieldIndexes {
  byLevel: Map<string, number[]>; // level -> entry indices
  byEnvironment: Map<string, number[]>; // environment -> entry indices
  byKind: Map<string, number[]>; // log kind -> entry indices

  timestamps: { index: number; timestamp: number }[];

  messageKeywords: Map<string, number[]>; // keyword -> entry indices

  totalEntries: number;
  indexedAt: number;
  memoryEstimateBytes: number;
}

export class FieldIndexer {
  private indexes: FieldIndexes;

  constructor() {
    this.indexes = this.createEmptyIndexes();
  }

  buildIndexes(entries: ParsedLogEntry[]): void {
    const startTime = performance.now();
    this.indexes = this.createEmptyIndexes();

    entries.forEach((entry, index) => {
      this.indexEntry(entry, index);
    });

    this.indexes.timestamps.sort((a, b) => a.timestamp - b.timestamp);

    this.indexes.totalEntries = entries.length;
    this.indexes.indexedAt = Date.now();
    this.indexes.memoryEstimateBytes = this.estimateMemoryUsage();

    const duration = performance.now() - startTime;
    console.debug(`[FieldIndexer] Built indexes for ${entries.length} entries in ${duration.toFixed(2)}ms`);
    console.debug(`[FieldIndexer] Estimated memory: ${(this.indexes.memoryEstimateBytes / 1024 / 1024).toFixed(2)}MB`);
  }

  addEntry(entry: ParsedLogEntry, index: number): void {
    this.indexEntry(entry, index);
    this.indexes.totalEntries++;
  }

  addBatch(entries: ParsedLogEntry[], startIndex: number): void {
    const startTimestampIndex = this.indexes.timestamps.length;

    entries.forEach((entry, offset) => {
      this.indexEntry(entry, startIndex + offset);
    });

    this.indexes.totalEntries += entries.length;

    // Only sort the newly added timestamps and merge with existing ones
    // This is much faster than re-sorting the entire array
    if (this.indexes.timestamps.length > startTimestampIndex) {
      const newTimestamps = this.indexes.timestamps.slice(startTimestampIndex);
      newTimestamps.sort((a, b) => a.timestamp - b.timestamp);

      // If we had existing timestamps, merge the sorted arrays
      if (startTimestampIndex > 0) {
        const existingTimestamps = this.indexes.timestamps.slice(0, startTimestampIndex);
        this.indexes.timestamps = this.mergeSortedTimestamps(existingTimestamps, newTimestamps);
      } else {
        this.indexes.timestamps = newTimestamps;
      }
    }

    this.indexes.memoryEstimateBytes = this.estimateMemoryUsage();
  }

  getIndexes(): Readonly<FieldIndexes> {
    return this.indexes;
  }

  queryByLevel(level: string): number[] {
    return this.indexes.byLevel.get(level) || [];
  }

  queryByEnvironment(env: string): number[] {
    return this.indexes.byEnvironment.get(env) || [];
  }

  queryByKind(kind: string): number[] {
    return this.indexes.byKind.get(kind) || [];
  }

  queryTimestampRange(startMs: number | null, endMs: number | null): number[] {
    const timestamps = this.indexes.timestamps;
    const results: number[] = [];

    if (timestamps.length === 0) return results;

    const actualStart = startMs ?? -Infinity;
    const actualEnd = endMs ?? Infinity;

    // Binary search for start position
    let left = 0;
    let right = timestamps.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (timestamps[mid].timestamp < actualStart) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Collect all entries in range
    for (let i = left; i < timestamps.length && timestamps[i].timestamp <= actualEnd; i++) {
      results.push(timestamps[i].index);
    }

    return results;
  }

  queryByKeyword(keyword: string): number[] {
    return this.indexes.messageKeywords.get(keyword.toLowerCase()) || [];
  }

  clear(): void {
    this.indexes = this.createEmptyIndexes();
  }

  getStats(): {
    totalEntries: number;
    levelIndexSize: number;
    environmentIndexSize: number;
    kindIndexSize: number;
    timestampIndexSize: number;
    keywordIndexSize: number;
    memoryEstimateMB: number;
  } {
    return {
      totalEntries: this.indexes.totalEntries,
      levelIndexSize: this.indexes.byLevel.size,
      environmentIndexSize: this.indexes.byEnvironment.size,
      kindIndexSize: this.indexes.byKind.size,
      timestampIndexSize: this.indexes.timestamps.length,
      keywordIndexSize: this.indexes.messageKeywords.size,
      memoryEstimateMB: this.indexes.memoryEstimateBytes / 1024 / 1024,
    };
  }

  /**
   * Merge two sorted timestamp arrays efficiently
   */
  private mergeSortedTimestamps(
    arr1: { index: number; timestamp: number }[],
    arr2: { index: number; timestamp: number }[],
  ): { index: number; timestamp: number }[] {
    const result: { index: number; timestamp: number }[] = [];
    let i = 0;
    let j = 0;

    while (i < arr1.length && j < arr2.length) {
      if (arr1[i].timestamp <= arr2[j].timestamp) {
        result.push(arr1[i]);
        i++;
      } else {
        result.push(arr2[j]);
        j++;
      }
    }

    // Add remaining elements
    while (i < arr1.length) {
      result.push(arr1[i]);
      i++;
    }
    while (j < arr2.length) {
      result.push(arr2[j]);
      j++;
    }

    return result;
  }

  private createEmptyIndexes(): FieldIndexes {
    return {
      byLevel: new Map(),
      byEnvironment: new Map(),
      byKind: new Map(),
      timestamps: [],
      messageKeywords: new Map(),
      totalEntries: 0,
      indexedAt: Date.now(),
      memoryEstimateBytes: 0,
    };
  }

  private indexEntry(entry: ParsedLogEntry, index: number): void {
    // Index by level
    try {
      const level = getNormalizedLevel(entry);
      if (!this.indexes.byLevel.has(level)) {
        this.indexes.byLevel.set(level, []);
      }
      this.indexes.byLevel.get(level)!.push(index);
    } catch {
      // Skip if level extraction fails
    }

    // Index by environment
    try {
      const env = getNormalizedEnvironment(entry);
      if (!this.indexes.byEnvironment.has(env)) {
        this.indexes.byEnvironment.set(env, []);
      }
      this.indexes.byEnvironment.get(env)!.push(index);
    } catch {
      // Skip if environment extraction fails
    }

    // Index by kind
    const kind = entry.kind;
    if (!this.indexes.byKind.has(kind)) {
      this.indexes.byKind.set(kind, []);
    }
    this.indexes.byKind.get(kind)!.push(index);

    // Index timestamp
    const timestamp = this.extractTimestamp(entry);
    if (timestamp !== null) {
      this.indexes.timestamps.push({ index, timestamp });
    }

    // Index message keywords
    const message = this.extractMessage(entry);
    if (message) {
      this.indexMessageKeywords(message, index);
    }
  }

  private extractTimestamp(entry: ParsedLogEntry): number | null {
    try {
      switch (entry.kind) {
        case 'pino':
          return typeof entry.entry.time === 'number' ? entry.entry.time : null;
        case 'winston':
          return Date.parse(entry.entry.timestamp);
        case 'loki':
        case 'promtail': {
          const promtailEntry = entry.entry as unknown as { ts?: string };
          return promtailEntry.ts ? Date.parse(promtailEntry.ts) : null;
        }
        case 'docker': {
          const dockerEntry = entry.entry as unknown as { time?: string };
          return dockerEntry.time ? Date.parse(dockerEntry.time) : null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private extractMessage(entry: ParsedLogEntry): string | null {
    try {
      switch (entry.kind) {
        case 'pino':
          return entry.entry.msg || null;
        case 'winston':
          return entry.entry.message || null;
        case 'loki': {
          const lokiEntry = entry.entry as unknown as { line?: string };
          return lokiEntry.line ?? null;
        }
        case 'promtail': {
          const promtailEntry = entry.entry as unknown as { message?: string };
          return promtailEntry.message ?? null;
        }
        case 'docker': {
          const dockerEntry = entry.entry as unknown as { log?: string };
          return dockerEntry.log ?? null;
        }
        case 'text': {
          const textEntry = entry.entry as unknown as { line?: string };
          return textEntry.line ?? null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private indexMessageKeywords(message: string, index: number): void {
    const words = message
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !this.isStopWord(w));

    const keywords = words.slice(0, 10);

    keywords.forEach((keyword) => {
      if (!this.indexes.messageKeywords.has(keyword)) {
        this.indexes.messageKeywords.set(keyword, []);
      }
      this.indexes.messageKeywords.get(keyword)!.push(index);
    });
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'a',
      'an',
      'as',
      'by',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'it',
      'its',
      'from',
    ]);
    return stopWords.has(word);
  }

  private estimateMemoryUsage(): number {
    let bytes = 0;

    // Hash maps: key strings + array overhead
    this.indexes.byLevel.forEach((indices, key) => {
      bytes += key.length * 2; // String chars (UTF-16)
      bytes += indices.length * 4; // Array of numbers (32-bit)
      bytes += 100; // Map entry overhead
    });

    this.indexes.byEnvironment.forEach((indices, key) => {
      bytes += key.length * 2;
      bytes += indices.length * 4;
      bytes += 100;
    });

    this.indexes.byKind.forEach((indices, key) => {
      bytes += key.length * 2;
      bytes += indices.length * 4;
      bytes += 100;
    });

    // Timestamps: array of objects
    bytes += this.indexes.timestamps.length * 12; // 2 numbers per entry + overhead

    // Message keywords
    this.indexes.messageKeywords.forEach((indices, key) => {
      bytes += key.length * 2;
      bytes += indices.length * 4;
      bytes += 100;
    });

    return bytes;
  }
}
