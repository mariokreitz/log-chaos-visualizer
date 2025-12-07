import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, InputSignal, output, signal } from '@angular/core';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';

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

  // Derived stack preview and presence checks using the raw JSON representation
  public readonly hasStack = computed(() => {
    const raw = this.rawJson;
    return typeof raw === 'string' && raw.includes('\n');
  });

  public readonly stackPreview = computed(() => {
    const raw = this.rawJson;
    if (typeof raw !== 'string') return '';
    // Show first 1000 chars as preview
    return raw.length > 1000 ? raw.slice(0, 1000) + '\n... (truncated)' : raw;
  });

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

  public copyRawJson(): void {
    const txt = this.rawJson ?? '';
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(txt);
    }
  }
}
