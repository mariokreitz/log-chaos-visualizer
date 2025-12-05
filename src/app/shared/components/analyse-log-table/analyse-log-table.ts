import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  InputSignal,
  viewChild,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';

@Component({
  selector: 'app-analyse-log-table',
  imports: [MatFormFieldModule, MatInputModule, MatTableModule, MatSortModule, MatPaginatorModule],
  templateUrl: './analyse-log-table.html',
  styleUrls: ['./analyse-log-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseLogTable implements AfterViewInit {
  displayedColumns: string[] = ['kind', 'timestamp', 'level', 'message', 'source'];
  dataSource: MatTableDataSource<ParsedLogEntry> = new MatTableDataSource<ParsedLogEntry>([]);
  public readonly allEntries: InputSignal<ParsedLogEntry[]> = input.required<ParsedLogEntry[]>();
  paginator = viewChild(MatPaginator);
  sort = viewChild(MatSort);

  constructor() {
    effect(() => {
      this.dataSource.data = this.allEntries() ?? [];
    });
  }

  ngAfterViewInit() {
    if (this.paginator() && this.dataSource) {
      this.dataSource.paginator = this.paginator();
      this.dataSource.sort = this.sort();
    }
  }
  applyFilter(event: Event) {
    if (this.dataSource) {
      const filterValue = (event.target as HTMLInputElement).value;
      this.dataSource.filter = filterValue.trim().toLowerCase();

      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    }
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

  formatLevel(row: ParsedLogEntry): string {
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

  formatMessage(row: ParsedLogEntry): string {
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

  formatSource(row: ParsedLogEntry): string {
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
