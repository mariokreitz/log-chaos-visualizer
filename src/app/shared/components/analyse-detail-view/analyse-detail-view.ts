import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, output, signal } from '@angular/core';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';
import type {
  DockerLogLine,
  LokiEntry,
  PinoEntry,
  PromtailTextLine,
  WinstonEntry,
} from '../../../core/types/log-entries';

@Component({
  selector: 'app-analyse-detail-view',
  imports: [CommonModule],
  templateUrl: './analyse-detail-view.html',
  styleUrls: ['./analyse-detail-view.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseDetailView {
  // Entry to display (signal input) - ensure correct generic typing
  public readonly entry: InputSignal<ParsedLogEntry | null> = input<ParsedLogEntry | null>(null);
  // Whether the panel is expanded (kept for compatibility with external callers)
  public readonly expanded: InputSignal<boolean> = input<boolean>(false);
  // Output event when the user closes the detail
  public readonly closed = output<void>();

  // Local UI state: toggles for raw JSON and stack trace visibility
  public readonly showRawJson = signal<boolean>(false);
  public readonly showStack = signal<boolean>(false);

  // Computed formatted timestamp
  public readonly formattedTimestamp = computed(() => {
    const e = this.entry();
    if (!e) return '';
    const ts = e.normalized?.timestamp;
    return ts ? new Date(ts).toLocaleString() : '';
  });

  // Computed array of normalized entries for safe iteration in template
  public readonly normalizedEntries = computed(() => {
    const e = this.entry();
    if (!e || !e.normalized) return [] as [string, unknown][];
    return Object.entries(e.normalized) as [string, unknown][];
  });

  // Computed entries for normalized.meta specifically
  public readonly metaEntries = computed(() => {
    const e = this.entry();
    if (!e || !e.normalized?.meta) return [] as [string, unknown][];
    return Object.entries(e.normalized.meta) as [string, unknown][];
  });

  // Preferred human-readable message extracted from the entry (safe typing)
  public readonly messageText = computed(() => {
    const e = this.entry();
    if (!e) return '';
    // Prefer normalized message
    const normMsg = e.normalized?.message;
    if (typeof normMsg === 'string' && normMsg.length > 0) return normMsg;

    // Fallback based on original kind
    switch (e.kind) {
      case 'pino': {
        const p = e.entry as PinoEntry;
        return (p.msg ?? JSON.stringify(p)) as string;
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
        return (p as PromtailTextLine).message ?? '';
      }
      default:
        // unknown-json or text
        return (e.entry as { line?: string }).line ?? '';
    }
  });

  // Extract a stack trace-like string if available from common locations
  public readonly stackText = computed(() => {
    const e = this.entry();
    if (!e) return null;

    // Check normalized first
    const norm = e.normalized as { stack?: string } | undefined;
    if (norm && typeof norm.stack === 'string' && norm.stack.length > 0) return norm.stack;

    // Check known entry shapes
    if (e.kind === 'pino') {
      const p = e.entry as PinoEntry;
      // pino often stores stack in `err` or in `meta`
      const maybeMeta = (p.meta ?? {}) as Record<string, unknown>;
      if (typeof maybeMeta['stack'] === 'string') return maybeMeta['stack'] as string;
      if (typeof (p as unknown as Record<string, unknown>)['stack'] === 'string')
        return (p as unknown as Record<string, unknown>)['stack'] as string;
    }

    if (e.kind === 'winston') {
      const w = e.entry as WinstonEntry;
      const maybeMeta = (w.meta ?? {}) as Record<string, unknown>;
      if (typeof maybeMeta['stack'] === 'string') return maybeMeta['stack'] as string;
    }

    // Generic fallback: stringify certain fields that often contain traces
    const entryObj = e.entry as Record<string, unknown>;
    for (const key of ['stack', 'error', 'err', 'trace']) {
      const v = entryObj[key];
      if (typeof v === 'string' && v.length > 0) return v;
      if (v && typeof v === 'object') {
        try {
          const asStr = JSON.stringify(v, null, 2);
          if (asStr.length > 0) return asStr;
        } catch {
          // ignore
        }
      }
    }

    return null;
  });

  // Helper to surface HTTP info in a typed way (reads from normalized.http)
  public readonly httpInfo = computed(() => {
    const e = this.entry();
    if (!e) return null;
    const h = e.normalized?.http;
    if (!h) return null;
    return {
      method: h.method ?? null,
      url: h.url ?? null,
      statusCode: h.statusCode ?? null,
      responseTime: h.responseTime ?? null,
    } as { method: string | null; url: string | null; statusCode: number | null; responseTime: number | null };
  });

  // Update existing hasStack/stackPreview to use stackText when available
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
  // This is a non-invasive, no-op reference.
  private readonly _templateRefs = [
    this.hasStack,
    this.stackPreview,
    this.stackText,
    this.rawJson,
    this.toggleRawJson,
    this.toggleStack,
    this.onClose,
    this.copyRawJson,
  ];

  // Small helper to get a pretty-printed JSON string lazily
  public get rawJson(): string | null {
    const e = this.entry();
    if (!e) return null;
    try {
      return JSON.stringify(e, null, 2);
    } catch {
      return null;
    }
  }

  public toggleRawJson(): void {
    this.showRawJson.update((v) => !v);
  }

  public toggleStack(): void {
    this.showStack.update((v) => !v);
  }

  public onClose(): void {
    this.closed.emit();
  }

  // Reference template-facing members in a private field so the TS analyzer
  // recognizes them as used (the template consumes them at runtime).

  public copyRawJson(): void {
    const txt = this.rawJson ?? '';
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(txt);
    }
  }
}
