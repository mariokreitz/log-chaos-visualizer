import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  InputSignal,
  output,
  signal,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
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
  imports: [CommonModule, MatChipsModule, MatIconModule],
  templateUrl: './analyse-detail-view.html',
  styleUrls: ['./analyse-detail-view.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseDetailView {
  public readonly entry: InputSignal<ParsedLogEntry | null> = input<ParsedLogEntry | null>(null);
  public readonly expanded: InputSignal<boolean> = input<boolean>(false);
  public readonly closed = output<void>();

  // UI state
  public readonly showStack = signal(false);
  public readonly showRaw = signal(false);
  // Unique heading id for aria
  public readonly headingId = computed(
    () => `detail-summary-${Math.abs(this.entry()?.normalized?.timestamp ?? Date.now())}`,
  );
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
  // Effect: reset UI state on entry change
  private readonly resetEffect = effect(() => {
    this.showStack.set(false);
    this.showRaw.set(false);
  });
  private readonly notification = inject(NotificationService);

  // Stack preview logic
  public hasStack(): boolean {
    const e = this.entry();
    return !!this.extractStackFromEntry(e);
  }

  public stackPreview(): string {
    const e = this.entry();
    const stack = this.extractStackFromEntry(e);
    if (!stack) return '';
    return stack.split('\n').slice(0, 3).join('\n');
  }

  public stackFull(): string {
    const e = this.entry();
    return this.extractStackFromEntry(e) ?? '';
  }

  public rawJson(): string {
    const e = this.entry();
    return e ? JSON.stringify(e, null, 2) : '';
  }

  public messageText(): string {
    const e = this.entry();
    return e?.normalized?.message ?? '';
  }

  public toggleStack(): void {
    this.showStack.update((v) => !v);
    this.showRaw.set(false);
  }

  // Helper to present values safely in the UI
  public formatValue(v: unknown): string {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  // Copy raw JSON to clipboard (graceful in non-browser envs)
  public async copyRawJson(): Promise<boolean> {
    const raw = this.rawJson();
    if (!raw) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(raw);
        this.notification.success('JSON copied to clipboard');
        return true;
      }
      this.notification.error('Failed to copy JSON');
      return false;
    } catch {
      this.notification.error('Failed to copy JSON');
      return false;
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

  private extractStackFromEntry(e: ParsedLogEntry | null): string | null {
    if (!e) return null;
    // Normalized stack first
    const norm = e.normalized as { stack?: string } | undefined;
    if (norm && typeof norm.stack === 'string' && norm.stack.length > 0) return norm.stack;

    // Known shapes: check common meta locations
    if ('meta' in e.normalized && e.normalized.meta) {
      const metaStack = this.safeGet(e.normalized.meta, 'stack');
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
