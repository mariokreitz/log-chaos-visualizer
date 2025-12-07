import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SearchService } from '../../../core/services/search.service';

@Component({
  selector: 'app-query-help-dialog',
  imports: [MatDialogModule, MatTabsModule, MatButtonModule, MatIconModule],
  templateUrl: './query-help-dialog.html',
  styleUrl: './query-help-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryHelpDialog {
  // Live announcement for accessibility (aria-live)
  protected readonly liveAnnouncement = signal<string>('');
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
          query: '(level=error OR level=fatal) AND contains(message, /database|connection/)',
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
  private readonly dialogRef = inject(MatDialogRef<QueryHelpDialog>);
  private readonly searchService = inject(SearchService);

  close(): void {
    this.dialogRef.close();
  }

  protected copyExample(query: string): void {
    const text = query;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => this.announce('Copied example to clipboard'))
        .catch(() => this.announce('Failed to copy example'));
    } else {
      // Fallback: attempt execCommand
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        this.announce('Copied example to clipboard');
      } catch {
        this.announce('Failed to copy example');
      }
      document.body.removeChild(el);
    }
  }

  protected insertExample(query: string): void {
    this.searchService.setQuery(query);
    this.announce('Inserted example into search bar');
    // Close dialog after inserting to reduce friction
    this.dialogRef.close();
  }

  private announce(message: string): void {
    this.liveAnnouncement.set(message);
    // Clear announcement after brief delay
    setTimeout(() => this.liveAnnouncement.set(''), 1500);
  }
}
