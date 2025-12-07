import type { ParsedBatch, ParsedLogEntry } from '../types/file-parse.types';

export class BatchPoster {
  private readonly batchSize: number;
  private entries: ParsedLogEntry[] = [];
  private rawCount = 0;
  private malformedCount = 0;

  constructor(batchSize = 500) {
    this.batchSize = batchSize;
  }

  add(entry: ParsedLogEntry, incrementMalformed = 0): ParsedBatch | null {
    this.entries.push(entry);
    this.rawCount += 1;
    this.malformedCount += incrementMalformed;

    if (this.entries.length >= this.batchSize) {
      return this.flushPartial();
    }
    return null;
  }

  flushPartial(chunkStartOffset = 0, chunkEndOffset = 0): ParsedBatch {
    const batch: ParsedBatch = {
      entries: this.entries.splice(0, this.entries.length),
      rawCount: this.rawCount,
      malformedCount: this.malformedCount,
      chunkStartOffset,
      chunkEndOffset,
    };
    this.rawCount = 0;
    this.malformedCount = 0;
    return batch;
  }

  hasPending(): boolean {
    return this.entries.length > 0;
  }

  flushFinal(totalSize: number): ParsedBatch | null {
    if (!this.hasPending()) return null;
    const batch: ParsedBatch = {
      entries: this.entries.splice(0, this.entries.length),
      rawCount: this.rawCount,
      malformedCount: this.malformedCount,
      chunkStartOffset: 0,
      chunkEndOffset: totalSize,
    };
    this.rawCount = 0;
    this.malformedCount = 0;
    return batch;
  }
}
