import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, output, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';

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
  public readonly detailEntries = computed(() => {
    const e = this.entry();
    if (!e || !e.normalized) return [];
    const exclude = ['message', 'timestamp', 'level', 'environment', 'kind'];
    return Object.entries(e.normalized)
      .filter(([key]) => !exclude.includes(key))
      .map(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return {
            key,
            value,
            subEntries: Object.entries(value).map(([subKey, subValue]) => ({ key: subKey, value: subValue })),
          };
        }
        return { key, value, subEntries: null };
      });
  });

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

  public messageText(): string {
    const e = this.entry();
    return e?.normalized?.message ?? '';
  }

  // Helper to present values safely in the UI
  private isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object';
  }

  private safeGet(obj: Record<string, unknown> | undefined, key: string): unknown {
    return obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
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
}
