import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, output, signal } from '@angular/core';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';
import type { DockerLogLine, LokiEntry, PinoEntry, PromtailTextLine, WinstonEntry } from '../../../core/types/log-entries';

@Component({
  selector: 'app-analyse-detail-view',
  imports: [CommonModule],
  templateUrl: './analyse-detail-view.html',
  styleUrls: ['./analyse-detail-view.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseDetailView {
  public readonly entry: InputSignal<ParsedLogEntry | null> = input<ParsedLogEntry | null>(null);
  public readonly expanded: InputSignal<boolean> = input<boolean>(false);
  public readonly closed = output<void>();

  public readonly showStack = signal(false);
  public readonly formattedTimestamp = computed(() => {
    const e = this.entry();
    if (!e) return '';
    const ts = e.normalized?.timestamp;
    return ts ? new Date(ts).toLocaleString() : '';
  });
  public readonly normalizedEntries = computed(() => {
    const e = this.entry();
    if (!e || !e.normalized) return [] as [string, unknown][];
    return Object.entries(e.normalized) as [string, unknown][];
  });
  public readonly metaEntries = computed(() => {
    const e = this.entry();
    if (!e || !e.normalized?.meta) return [] as [string, unknown][];
    return Object.entries(e.normalized.meta) as [string, unknown][];
  });
  public readonly messageText = computed(() => {
    const e = this.entry();
    return e ? this.extractMessageFromEntry(e) : '';
  });
  public readonly stackText = computed(() => {
    const e = this.entry();
    return e ? this.extractStackFromEntry(e) : null;
  });
  public readonly httpInfo = computed(() => {
    const e = this.entry();
    return e ? this.extractHttpInfo(e) : null;
  });
  public readonly hasStack = computed(() => {
    const st = this.stackText();
    if (st && st.length > 0) return true;
    const raw = this.rawJson;
    return typeof raw === 'string' && raw.includes('\n');
  });
  public readonly stackPreview = computed(() => {
    const st = this.stackText();
    const src = typeof st === 'string' && st.length > 0 ? st : (this.rawJson ?? '');
    if (!src) return '';
    return src.length > 1000 ? src.slice(0, 1000) + '\n... (truncated)' : src;
  });

  public get rawJson(): string | null {
    const e = this.entry();
    if (!e) return null;
    try {
      return JSON.stringify(e, null, 2);
    } catch {
      return null;
    }
  }

  private isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object';
  }

  private safeGet(obj: Record<string, unknown> | undefined, key: string): unknown {
    return obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
  }

  private extractMessageFromEntry(e: ParsedLogEntry): string {
    const nm = e.normalized?.message;
    if (typeof nm === 'string' && nm.length > 0) return nm;

    switch (e.kind) {
      case 'pino': {
        const p = e.entry as PinoEntry;
        if (p.msg && p.msg.length > 0) return p.msg;
        // try common fields
        return JSON.stringify(p);
      }
      case 'winston': {
        const w = e.entry as WinstonEntry;
        return w.message ?? '';
      }
      case 'loki': {
        const l = e.entry as LokiEntry;
        return l.line ?? '';
      }
      case 'docker': {
        const d = e.entry as DockerLogLine;
        return d.log ?? '';
      }
      case 'promtail': {
        const p = e.entry as PromtailTextLine;
        return p.message ?? '';
      }
      default:
        return (e.entry as { line?: string }).line ?? '';
    }
  }

  private extractStackFromEntry(e: ParsedLogEntry): string | null {
    // Normalized stack first
    const norm = e.normalized as { stack?: string } | undefined;
    if (norm && typeof norm.stack === 'string' && norm.stack.length > 0) return norm.stack;

    // Known shapes: check common meta locations
    if (e.kind === 'pino') {
      const p = e.entry as PinoEntry;
      const meta = (p.meta ?? {}) as Record<string, unknown>;
      const metaStack = this.safeGet(meta, 'stack');
      if (typeof metaStack === 'string') return metaStack;
      const alt = this.safeGet(p as unknown as Record<string, unknown>, 'stack');
      if (typeof alt === 'string') return alt;
    }

    if (e.kind === 'winston') {
      const w = e.entry as WinstonEntry;
      const meta = (w.meta ?? {}) as Record<string, unknown>;
      const metaStack = this.safeGet(meta, 'stack');
      if (typeof metaStack === 'string') return metaStack;
    }

    // Generic scan for common keys
    const entryObj = e.entry as Record<string, unknown>;
    const candidates = ['stack', 'error', 'err', 'trace'];
    for (const key of candidates) {
      const v = entryObj[key];
      if (typeof v === 'string' && v.length > 0) return v;
      if (this.isObject(v)) {
        try {
          const s = JSON.stringify(v, null, 2);
          if (s.length > 0) return s;
        } catch {
          // ignore
        }
      }
    }

    return null;
  }

  private extractHttpInfo(e: ParsedLogEntry) {
    const h = e.normalized?.http;
    if (!h) return null;
    return {
      method: h.method ?? null,
      url: h.url ?? null,
      statusCode: h.statusCode ?? null,
      responseTime: h.responseTime ?? null,
    } as { method: string | null; url: string | null; statusCode: number | null; responseTime: number | null };
  }
}
