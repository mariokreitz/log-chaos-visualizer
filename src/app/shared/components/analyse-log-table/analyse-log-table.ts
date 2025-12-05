import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, InputSignal, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';

@Component({
  selector: 'app-analyse-log-table',
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    ScrollingModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './analyse-log-table.html',
  styleUrls: ['./analyse-log-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseLogTable {
  public readonly allEntries: InputSignal<ParsedLogEntry[]> = input.required<ParsedLogEntry[]>();
  public readonly entries = computed<ParsedLogEntry[]>(() => this.allEntries() ?? []);
  public readonly filterControl = new FormControl<string>('');
  private readonly filter = signal<string>('');
  public readonly filteredEntries = computed<ParsedLogEntry[]>(() => {
    const f = this.filter().trim().toLowerCase();
    if (!f) return this.entries();
    return this.entries().filter((row) => {
      // Prefer worker-computed searchText; fall back to quick field checks if absent
      const search = (row as any).searchText ?? '';
      if (search && typeof search === 'string') {
        return search.includes(f);
      }
      // Very conservative fallback (avoid heavy formatting)
      const kind = String(row.kind ?? '').toLowerCase();
      const msg = String(
        (row.entry as any)?.msg ??
          (row.entry as any)?.message ??
          (row.entry as any)?.log ??
          (row.entry as any)?.line ??
          '',
      ).toLowerCase();
      return kind.includes(f) || msg.includes(f);
    });
  });

  constructor() {
    // Subscribe to the debounced FormControl observable and update the filter signal
    effect((onCleanup) => {
      const sub = this.filterControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe((v) => {
        const val = String(v ?? '').trim();
        this.filter.set(val);
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  public clearFilter(): void {
    this.filterControl.setValue('');
    this.filter.set('');
  }

  formatTimestamp(row: ParsedLogEntry): string {
    switch (row.kind) {
      case 'pino':
        return new Date(row.entry.time).toLocaleString();
      case 'winston':
        return String(row.entry.timestamp ?? '');
      case 'loki':
        return String(row.entry.ts ?? '');
      case 'promtail':
        return String(row.entry.ts ?? '');
      case 'docker':
        return String(row.entry.time ?? '');
      case 'text':
        return '';
      case 'unknown-json':
      default:
        return '';
    }
  }

  public trackByEntry(_index: number, item: ParsedLogEntry): string | number {
    // Prefer a stable identifier if available, fall back to index
    return (item as any)._id ?? (item as any)._lineNumber ?? _index;
  }

  public formatLevel(row: ParsedLogEntry): string {
    switch (row.kind) {
      case 'pino': {
        const map: Record<number, string> = {
          10: 'trace',
          20: 'debug',
          30: 'info',
          40: 'warn',
          50: 'error',
          60: 'fatal',
        };
        return map[(row.entry as any).level] ?? 'unknown';
      }
      case 'winston':
        return (row.entry as any).level ?? 'unknown';
      case 'loki':
        return ((row.entry as any).labels?.level as string) ?? 'unknown';
      case 'promtail':
        return (row.entry as any).level ?? 'unknown';
      case 'docker':
        return (row.entry as any).stream === 'stderr' ? 'error' : 'info';
      default:
        return 'unknown';
    }
  }

  public formatMessage(row: ParsedLogEntry): string {
    switch (row.kind) {
      case 'pino':
        return String((row.entry as any).msg ?? '');
      case 'winston':
        return String((row.entry as any).message ?? '');
      case 'loki':
        return String((row.entry as any).line ?? '');
      case 'promtail':
        return String((row.entry as any).message ?? '');
      case 'docker':
        return String((row.entry as any).log ?? '');
      case 'text':
        return String((row.entry as any).line ?? '');
      case 'unknown-json':
      default:
        return JSON.stringify((row as any).entry ?? '');
    }
  }

  public formatSource(row: ParsedLogEntry): string {
    switch (row.kind) {
      case 'pino': {
        const e = row.entry as any;
        return `${e.pid ?? ''}${e.hostname ? '@' + e.hostname : ''}${e.name ? ' (' + e.name + ')' : ''}`.trim();
      }
      case 'winston': {
        const meta = (row.entry as any).meta ?? {};
        return meta.requestId ?? meta.userId ?? meta.traceId ?? '';
      }
      case 'loki':
        return (row.entry as any).labels?.job ?? '';
      case 'promtail':
        return '';
      case 'docker':
        return (row.entry as any).stream ?? '';
      case 'text':
      case 'unknown-json':
      default:
        return '';
    }
  }
}
