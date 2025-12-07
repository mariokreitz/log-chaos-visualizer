import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from '../../../core/services/notification.service';
import { SearchService } from '../../../core/services/search.service';
import { QueryExampleItem } from './query-example-item';

@Component({
  selector: 'app-query-help-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    QueryExampleItem,
  ],
  templateUrl: './query-help-dialog.html',
  styleUrls: ['./query-help-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryHelpDialog {
  // Live announcement for accessibility (aria-live)
  protected readonly liveAnnouncement = signal<string>('');
  // Merge mode for inserting examples: 'replace' | 'append-space' | 'append-and'
  protected readonly mergeMode = signal<'replace' | 'append-space' | 'append-and'>('replace');
  // Examples structured data (raw query strings are used when inserting/copying)
  protected readonly exampleSections = [
    {
      title: 'Find Errors',
      items: [
        { query: 'level=error', description: 'All error logs' },
        { query: 'level=error AND environment=prod', description: 'Production errors only' },
        { query: 'contains(message, "exception")', description: 'Logs containing "exception"' },
      ],
    },
    {
      title: 'API Issues',
      items: [
        { query: 'contains(message, "api") AND level=error', description: 'API-related errors' },
        { query: 'statusCode>=500', description: 'Server errors (5xx status codes)' },
        { query: 'matches(message, /api.*timeout/i)', description: 'API timeout errors (regex)' },
      ],
    },
    {
      title: 'Complex Filters',
      items: [
        {
          query: '(level=error OR level=fatal) AND contains(message, /database|connection/i)',
          description: 'Critical logs with database/connection issues',
        },
        {
          query: 'level=warn AND contains(message, "retry") AND NOT contains(message, "success")',
          description: 'Failed retry attempts',
        },
        {
          query: 'level=error AND environment=prod AND contains(message, "api")',
          description: 'Production API errors',
        },
      ],
    },
  ] as const;
  // Examples per tab so examples appear where users expect them
  protected readonly operatorsExamples = [
    { query: 'level=error', description: 'All error logs' },
    { query: 'level!=debug', description: 'Exclude debug logs' },
    { query: 'statusCode>=500', description: 'Server errors (5xx)' },
    { query: '(level=error OR level=fatal) AND environment=prod', description: 'Critical production errors' },
  ] as const;
  protected readonly functionsExamples = [
    { query: 'contains(message, "timeout")', description: 'Logs containing "timeout"' },
    { query: 'startsWith(url, "/api")', description: 'Requests starting with /api' },
    { query: 'matches(message, /api.*timeout/i)', description: 'API timeout errors (regex)' },
  ] as const;
  protected readonly fieldsExamples = [
    { query: 'hostname=web-1', description: 'Logs from a specific host' },
    { query: 'statusCode>=400', description: 'Client and server errors (4xx/5xx)' },
    { query: 'pid=12345', description: 'Filter by process id' },
  ] as const;
  protected readonly regexExamples = [
    { query: 'matches(message, /timeout/i)', description: 'Case-insensitive "timeout"' },
    { query: 'matches(message, /\\d{3}\\s+error/)', description: 'Three digits followed by "error"' },
    { query: 'matches(message, /^ERROR.*timeout$/)', description: 'Starts with ERROR and ends with timeout' },
  ] as const;
  protected readonly performanceExamples = [
    { query: 'level=error AND environment=prod', description: 'Indexed fields first for speed' },
    { query: 'level=error AND contains(message, "api")', description: 'Narrow before regex' },
  ] as const;
  protected readonly referenceExamples = [
    { query: 'level=error AND contains(message, "exception")', description: 'Find errors with exceptions' },
    { query: 'timestamp>="2024-12-01" AND timestamp<"2024-12-07"', description: 'Logs within a date range' },
  ] as const;
  private readonly dialogRef = inject(MatDialogRef<QueryHelpDialog>);
  private readonly searchService = inject(SearchService);
  private readonly notification = inject(NotificationService);

  close(): void {
    this.dialogRef.close();
  }

  protected copyExample(query: string): void {
    const text = query;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.announce('Copied example to clipboard');
          this.notification.success('Copied example to clipboard');
        })
        .catch(() => {
          this.announce('Failed to copy example');
          this.notification.error('Failed to copy example');
        });
    } else {
      // Fallback: attempt execCommand
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        this.announce('Copied example to clipboard');
        this.notification.success('Copied example to clipboard');
      } catch {
        this.announce('Failed to copy example');
        this.notification.error('Failed to copy example');
      }
      document.body.removeChild(el);
    }
  }

  protected insertExample(query: string): void {
    // Merge logic based on selected mode
    const current = this.searchService.query();
    const mode = this.mergeMode();
    let newQuery: string;
    if (mode === 'append-space') {
      newQuery = current && current.trim() ? `${current.trim()} ${query}` : query;
    } else if (mode === 'append-and') {
      // If current contains logical operators or spaces, wrap in parentheses for clarity
      const shouldWrap = /\b(AND|OR|NOT)\b|\(|\)/i.test(current);
      const left = current && current.trim() ? (shouldWrap ? `(${current.trim()})` : current.trim()) : '';
      newQuery = left ? `${left} AND ${query}` : query;
    } else {
      // replace
      newQuery = query;
    }

    this.searchService.setQuery(newQuery);
    this.announce('Inserted example into search bar');
    this.notification.success('Inserted example into search bar');
    // Close dialog after inserting to reduce friction
    this.dialogRef.close();
  }

  protected setMergeMode(value: 'replace' | 'append-space' | 'append-and'): void {
    this.mergeMode.set(value);
  }

  private announce(message: string): void {
    this.liveAnnouncement.set(message);
    // Clear announcement after brief delay
    setTimeout(() => this.liveAnnouncement.set(''), 1500);
  }
}
