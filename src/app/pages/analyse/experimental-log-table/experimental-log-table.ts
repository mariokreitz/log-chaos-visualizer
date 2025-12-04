import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { FileParseService } from '../../../core/services/file-parse.service';
import type { ParsedLogEntry } from '../../../core/types/file-parse.types';

@Component({
  selector: 'app-experimental-log-table',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    ScrollingModule,
  ],
  templateUrl: './experimental-log-table.html',
  styleUrl: './experimental-log-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentalLogTable implements AfterViewInit {
  readonly search = new FormControl('');
  readonly columns = ['timestamp', 'level', 'environment', 'kind', 'message'];
  readonly pageIndex = signal(0);
  readonly pageSize = signal(50);
  readonly matchedCount = computed(() => this.filteredEntries().length);
  private readonly parse = inject(FileParseService);
  readonly entries = computed(() => this.parse.allEntries());
  readonly filteredEntries = computed(() => {
    const q = (this.search.value ?? '').toString().trim().toLowerCase();
    if (!q) return this.entries();
    return this.entries().filter((e) => {
      const parts: string[] = [];
      parts.push(e.kind);
      if (e.kind === 'pino') {
        const p = e.entry; // PinoEntry
        parts.push(String(p.msg ?? ''));
        parts.push(String(p.hostname ?? ''));
        parts.push(String((p.meta as Record<string, unknown>)?.['environment'] ?? ''));
      } else if (e.kind === 'winston') {
        const w = e.entry; // WinstonEntry
        parts.push(String(w.message ?? ''));
        parts.push(String((w.meta as Record<string, unknown>)?.['requestId'] ?? ''));
      } else if (e.kind === 'loki') {
        const l = e.entry; // LokiEntry
        parts.push(String(l.line ?? ''));
      } else if (e.kind === 'promtail') {
        const p = e.entry; // PromtailTextLine
        parts.push(String(p.message ?? ''));
      } else if (e.kind === 'docker') {
        const d = e.entry; // DockerLogLine
        parts.push(String(d.log ?? ''));
      } else if (e.kind === 'text') {
        parts.push(String(e.entry.line ?? ''));
      } else {
        parts.push(String(JSON.stringify((e.entry as unknown) || {})));
      }

      return parts.join(' ').toLowerCase().includes(q);
    });
  });
  readonly totalCount = computed(() => this.entries().length);
  private readonly sortActive = signal<string | null>(null);
  private readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly sortedEntries = computed(() => {
    const arr = this.filteredEntries().slice();
    const active = this.sortActive();
    const dir = this.sortDirection();
    if (!active || dir === '') return arr;

    arr.sort((a, b) => {
      let va: string | number | null;
      let vb: string | number | null;

      switch (active) {
        case 'timestamp':
          va = this.getTimestampValue(a) ?? '';
          vb = this.getTimestampValue(b) ?? '';
          break;
        case 'level':
          va = this.formatLevel(a) ?? '';
          vb = this.formatLevel(b) ?? '';
          break;
        case 'environment':
          va = this.formatEnvironment(a) ?? '';
          vb = this.formatEnvironment(b) ?? '';
          break;
        case 'kind':
          va = a.kind;
          vb = b.kind;
          break;
        case 'message':
          va = this.getMessagePreview(a) ?? '';
          vb = this.getMessagePreview(b) ?? '';
          break;
        default:
          va = '';
          vb = '';
      }

      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return dir === 'asc' ? cmp : -cmp;
    });

    return arr;
  });
  readonly paginatedEntries = computed(() => {
    const page = this.pageIndex();
    const size = this.pageSize();
    const start = page * size;
    return this.sortedEntries().slice(start, start + size);
  });
  @ViewChild(MatPaginator) private paginator?: MatPaginator;
  @ViewChild(MatSort) private matSort?: MatSort;

  ngAfterViewInit(): void {
    // Wire up MatSort and MatPaginator events if available
    if (this.matSort) {
      this.matSort.sortChange.subscribe((s: Sort) => this.onSort(s));
    }
    if (this.paginator) {
      this.paginator.page.subscribe((p: PageEvent) => this.onPage(p));
    }
  }

  onPage(ev: PageEvent): void {
    this.pageIndex.set(ev.pageIndex);
    this.pageSize.set(ev.pageSize);
  }

  onSort(ev: Sort): void {
    this.sortActive.set(ev.active ?? null);
    this.sortDirection.set((ev.direction as 'asc' | 'desc' | '') ?? '');
    this.pageIndex.set(0);
    if (this.paginator) this.paginator.firstPage?.();
  }

  formatTimestamp(entry: ParsedLogEntry): string {
    try {
      const v = this.getTimestampValue(entry);
      return v ? new Date(v).toISOString() : '';
    } catch {
      return '';
    }
  }

  formatLevel(entry: ParsedLogEntry): string {
    if (entry.kind === 'pino') {
      const lvl = entry.entry.level;
      return lvl !== undefined ? String(lvl) : '';
    }
    if (entry.kind === 'winston') {
      return String(entry.entry.level ?? '');
    }
    if (entry.kind === 'promtail') {
      return String(entry.entry.level ?? '');
    }
    if (entry.kind === 'text') {
      return String(entry.entry.line ?? '').split(/\s+/, 1)[0];
    }
    return '';
  }

  formatEnvironment(entry: ParsedLogEntry): string {
    if (entry.kind === 'loki') {
      return String(entry.entry.labels?.environment ?? '');
    }
    if (entry.kind === 'pino') {
      return String((entry.entry.meta as Record<string, unknown>)?.['environment'] ?? '');
    }
    if (entry.kind === 'winston') {
      return String((entry.entry.meta as Record<string, unknown>)?.['environment'] ?? '');
    }
    if (entry.kind === 'docker') {
      const log = String(entry.entry.log ?? '');
      const m = /env=(dev|staging|prod)\b/.exec(log);
      return m ? m[1] : '';
    }
    if (entry.kind === 'text') {
      const line = String(entry.entry.line ?? '');
      const m = /env=(dev|staging|prod)\b/.exec(line);
      return m ? m[1] : '';
    }
    return '';
  }

  getMessagePreview(entry: ParsedLogEntry): string {
    if (entry.kind === 'pino') return String(entry.entry.msg ?? '');
    if (entry.kind === 'winston') return String(entry.entry.message ?? '');
    if (entry.kind === 'loki') return String(entry.entry.line ?? '');
    if (entry.kind === 'promtail') return String(entry.entry.message ?? '');
    if (entry.kind === 'docker') return String(entry.entry.log ?? '');
    if (entry.kind === 'text') return String(entry.entry.line ?? '');
    try {
      return JSON.stringify(entry.entry);
    } catch {
      return '';
    }
  }

  private getTimestampValue(entry: ParsedLogEntry): number | null {
    try {
      if (entry.kind === 'pino') return entry.entry.time ?? null;
      if (entry.kind === 'winston') return entry.entry.timestamp ? Date.parse(entry.entry.timestamp) : null;
      if (entry.kind === 'loki') return entry.entry.ts ? Date.parse(entry.entry.ts) : null;
      if (entry.kind === 'promtail') return entry.entry.ts ? Date.parse(entry.entry.ts) : null;
      if (entry.kind === 'docker') return entry.entry.time ? Date.parse(entry.entry.time) : null;
    } catch {
      return null;
    }
    return null;
  }
}
