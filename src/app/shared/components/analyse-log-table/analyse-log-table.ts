import { ScrollingModule } from '@angular/cdk/scrolling';
import { DecimalPipe } from '@angular/common';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  InputSignal,
  signal,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FileParseService } from '../../../core/services/file-parse.service';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';
import { extractFieldValue } from '../../../core/utils/field-extractor';
import { formatSourceForIndex } from '../../../core/utils/search-utils';
import { SearchInput } from '../search-input/search-input';

@Component({
  selector: 'app-analyse-log-table',
  imports: [SearchInput, ScrollingModule, MatProgressSpinnerModule, DecimalPipe],
  templateUrl: './analyse-log-table.html',
  styleUrls: ['./analyse-log-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseLogTable {
  public readonly entries: InputSignal<ParsedLogEntry[]> = input.required<ParsedLogEntry[]>();
  public readonly isSearching: InputSignal<boolean> = input(false);
  public readonly searchQuery = signal<string>('');
  // Virtual scroll configuration
  public readonly itemSize = 48; // Height of each row in pixels
  public readonly minBufferPx = 200; // Minimum buffer size in pixels
  public readonly maxBufferPx = 400; // Maximum buffer size in pixels
  // Loading state management
  public noData = computed(() => !this.isSearching() && this.entries().length === 0);
  public shouldShowEmpty = computed(() => this.entries().length === 0 && !this.isSearching());
  private readonly fileParse = inject(FileParseService);
  public readonly lastSearchDurationMs = this.fileParse.lastSearchDurationMs;
  public readonly lastSearchResultCount = this.fileParse.lastSearchResultCount;
  private readonly searchSubject = new Subject<string>();

  constructor() {
    effect((onCleanup) => {
      const sub = this.searchSubject.pipe(debounceTime(200), distinctUntilChanged()).subscribe((query) => {
        const trimmedQuery = query.trim();
        this.fileParse.setFilterQuery(trimmedQuery);
      });

      onCleanup(() => {
        sub.unsubscribe();
        this.searchSubject.complete();
      });
    });
  }

  public onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  public onSearchClear(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  public onOpenHelp(): void {
    // TODO: Open query help dialog (will be implemented in next step)
    console.log('[AnalyseLogTable] Help requested - dialog component pending');
  }

  /**
   * Format timestamp using normalized entry structure
   * Converts epoch milliseconds to localized string
   */
  public formatTimestamp(row: ParsedLogEntry): string {
    try {
      // Use normalized timestamp if available
      if ('normalized' in row && row.normalized?.timestamp) {
        return new Date(row.normalized.timestamp).toLocaleString();
      }
      // Fallback to raw entry extraction
      const value = extractFieldValue(row, 'timestamp');
      if (typeof value === 'number') {
        return new Date(value).toLocaleString();
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Format log level using normalized entry structure
   * Returns: trace, debug, info, warn, error, fatal, or unknown
   */
  public formatLevel(row: ParsedLogEntry): string {
    try {
      // Use normalized level if available
      if ('normalized' in row && row.normalized?.level) {
        return row.normalized.level;
      }
      // Fallback to raw entry extraction
      return String(extractFieldValue(row, 'level') ?? 'unknown');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Format log message using normalized entry structure
   * Extracts message from format-specific fields
   */
  public formatMessage(row: ParsedLogEntry): string {
    try {
      // Use normalized message if available
      if ('normalized' in row && row.normalized?.message) {
        return row.normalized.message;
      }
      // Fallback to raw entry extraction
      const value = extractFieldValue(row, 'message');
      return String(value ?? '');
    } catch {
      return '';
    }
  }

  /**
   * Get environment for the log entry using normalized structure
   */
  public formatEnvironment(row: ParsedLogEntry): string {
    try {
      // Use normalized environment if available
      if ('normalized' in row && row.normalized?.environment) {
        return row.normalized.environment;
      }
      // Fallback
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get kind/format of the log entry
   */
  public formatKind(row: ParsedLogEntry): string {
    return row.kind;
  }

  public formatSource(row: ParsedLogEntry): string {
    return formatSourceForIndex(row);
  }
}
