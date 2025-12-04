import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import type { ParsedLogEntry } from '../../../core/types/file-parse.types';

export type LogLevelTableColumn = 'timestamp' | 'level' | 'environment' | 'kind' | 'message';

interface SortState {
  active: LogLevelTableColumn | null;
  direction: 'asc' | 'desc' | '';
}

@Component({
  selector: 'app-log-level-tables',
  imports: [MatTabsModule, MatTableModule, MatSortModule, DatePipe],
  templateUrl: './log-level-tables.html',
  styleUrl: './log-level-tables.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogLevelTablesComponent {
  readonly errorEntries = input<ParsedLogEntry[] | null>(null);
  readonly fatalEntries = input<ParsedLogEntry[] | null>(null);
  readonly errorTabLabel = input<string>('Error logs');
  readonly fatalTabLabel = input<string>('Fatal logs');
  readonly ariaLabel = input<string>('Error and fatal log tables');

  readonly displayedColumns: LogLevelTableColumn[] = ['timestamp', 'level', 'environment', 'kind', 'message'];

  readonly errorRows = computed(() => this.errorEntries() ?? []);
  readonly fatalRows = computed(() => this.fatalEntries() ?? []);

  readonly errorSortState = computed<SortState>(() => ({ active: 'timestamp', direction: 'desc' }));
  readonly fatalSortState = computed<SortState>(() => ({ active: 'timestamp', direction: 'desc' }));

  readonly sortedErrorRows = computed(() => applySort(this.errorRows(), this.errorSortState()));
  readonly sortedFatalRows = computed(() => applySort(this.fatalRows(), this.fatalSortState()));

  getTimestampForTemplate(entry: ParsedLogEntry): number | null {
    return getTimestamp(entry);
  }

  getLevelForTemplate(entry: ParsedLogEntry): string {
    return getLevel(entry);
  }

  getEnvironmentForTemplate(entry: ParsedLogEntry): string {
    return getEnvironment(entry);
  }

  getMessageForTemplate(entry: ParsedLogEntry): string {
    return getMessage(entry);
  }

  getKindForTemplate(entry: ParsedLogEntry): string {
    return entry.kind;
  }
}

function getTimestamp(entry: ParsedLogEntry): number | null {
  if (entry.kind === 'pino') {
    return entry.entry.time;
  }
  if (entry.kind === 'winston') {
    const date = Date.parse(entry.entry.timestamp);
    return Number.isNaN(date) ? null : date;
  }
  if (entry.kind === 'loki') {
    const date = Date.parse(entry.entry.ts);
    return Number.isNaN(date) ? null : date;
  }
  if (entry.kind === 'promtail') {
    const date = Date.parse(entry.entry.ts);
    return Number.isNaN(date) ? null : date;
  }
  if (entry.kind === 'docker') {
    const date = Date.parse(entry.entry.time);
    return Number.isNaN(date) ? null : date;
  }
  return null;
}

function getEnvironment(entry: ParsedLogEntry): string {
  if (entry.kind === 'loki') {
    return entry.entry.labels.environment ?? 'unknown';
  }
  if (entry.kind === 'pino') {
    return 'unknown';
  }
  if (entry.kind === 'winston') {
    return 'unknown';
  }
  if (entry.kind === 'promtail') {
    return 'unknown';
  }
  if (entry.kind === 'docker') {
    return 'unknown';
  }
  return 'unknown';
}

function getLevel(entry: ParsedLogEntry): string {
  if (entry.kind === 'pino') {
    const level = entry.entry.level;
    if (level === 10) return 'trace';
    if (level === 20) return 'debug';
    if (level === 30) return 'info';
    if (level === 40) return 'warn';
    if (level === 50) return 'error';
    if (level === 60) return 'fatal';
    return 'unknown';
  }
  if (entry.kind === 'winston') {
    return entry.entry.level;
  }
  if (entry.kind === 'promtail') {
    return entry.entry.level;
  }
  return 'unknown';
}

function getMessage(entry: ParsedLogEntry): string {
  if (entry.kind === 'pino') {
    return entry.entry.msg;
  }
  if (entry.kind === 'winston') {
    return entry.entry.message;
  }
  if (entry.kind === 'loki') {
    return entry.entry.line;
  }
  if (entry.kind === 'promtail') {
    return entry.entry.message;
  }
  if (entry.kind === 'docker') {
    return entry.entry.log;
  }
  if (entry.kind === 'text') {
    return entry.entry.line;
  }
  return '';
}

function applySort(rows: ParsedLogEntry[], state: SortState): ParsedLogEntry[] {
  if (!state.active || state.direction === '') {
    return rows;
  }

  const sorted = rows.slice();

  sorted.sort((a, b) => {
    let aValue: number | string | null = null;
    let bValue: number | string | null = null;

    if (state.active === 'timestamp') {
      aValue = getTimestamp(a);
      bValue = getTimestamp(b);
    } else if (state.active === 'environment') {
      aValue = getEnvironment(a);
      bValue = getEnvironment(b);
    } else if (state.active === 'kind') {
      aValue = a.kind;
      bValue = b.kind;
    } else if (state.active === 'level') {
      aValue = getLevel(a);
      bValue = getLevel(b);
    } else if (state.active === 'message') {
      aValue = getMessage(a);
      bValue = getMessage(b);
    }

    if (aValue === bValue) {
      return 0;
    }

    if (aValue === null || aValue === undefined) {
      return 1;
    }
    if (bValue === null || bValue === undefined) {
      return -1;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();

    if (aStr < bStr) {
      return -1;
    }
    if (aStr > bStr) {
      return 1;
    }
    return 0;
  });

  if (state.direction === 'desc') {
    sorted.reverse();
  }

  return sorted;
}
