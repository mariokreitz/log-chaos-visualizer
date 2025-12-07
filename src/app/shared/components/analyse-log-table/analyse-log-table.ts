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
  output,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FileParseService } from '../../../core/services/file-parse.service';
import { SearchService } from '../../../core/services/search.service';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';
import { extractFieldValue } from '../../../core/utils/field-extractor';
import { formatSourceForIndex } from '../../../core/utils/search-utils';
import { QueryHelpDialog } from '../query-help-dialog/query-help-dialog';
import { SearchInput } from '../search-input/search-input'; // Formatting cache to avoid repeated computations

// Formatting cache to avoid repeated computations
interface FormattedEntry {
  timestamp: string;
  level: string;
  message: string;
  environment: string;
  source: string;
}

@Component({
  selector: 'app-analyse-log-table',
  imports: [
    SearchInput,
    ScrollingModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    DecimalPipe,
    MatPaginatorModule,
  ],
  templateUrl: './analyse-log-table.html',
  styleUrls: ['./analyse-log-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseLogTable {
  public readonly entries: InputSignal<ParsedLogEntry[]> = input.required<ParsedLogEntry[]>();
  public readonly isSearching: InputSignal<boolean> = input(false);
  public readonly searchQuery = signal<string>('');

  // Virtual scroll configuration - optimized for performance
  public readonly itemSize = 48; // Height of each row in pixels
  public readonly minBufferPx = 100; // Reduced from 200 for faster initial render
  public readonly maxBufferPx = 300; // Reduced from 400 for less memory usage

  // Loading state management
  public shouldShowEmpty = computed(() => this.entries().length === 0 && !this.isSearching());
  public readonly currentPage = signal<number>(1);
  // Pagination state
  public pageSize = signal<number>(2000);
  public readonly totalPages = computed(() => {
    const total = this.entries().length;
    return total === 0 ? 1 : Math.ceil(total / this.pageSize());
  });
  // Paginated entries for current page
  public readonly paginatedEntries = computed(() => {
    const all = this.entries();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    const end = start + size;
    return all.slice(start, end);
  });
  public readonly pageSizeOptions = [2000, 5000, 10000];
  public readonly showFirstLastButtons = true;
  // Outputs for parent component
  public readonly searchSubmit = output<string>();
  public readonly valueChange = output<string>();
  public readonly clear = output<void>();
  private readonly fileParse = inject(FileParseService);
  public readonly lastSearchDurationMs = this.fileParse.lastSearchDurationMs;
  public readonly lastSearchResultCount = this.fileParse.lastSearchResultCount;
  private readonly searchService = inject(SearchService);
  // Memoization cache for formatted values - use Map for better performance
  private formatCache = new Map<ParsedLogEntry, FormattedEntry>();
  private readonly MAX_CACHE_SIZE = 10000; // Limit cache to prevent memory issues
  private readonly dialog = inject(MatDialog);

  constructor() {
    // Sync searchQuery with SearchService
    effect(() => {
      const serviceQuery = this.searchService.query();
      if (serviceQuery !== this.searchQuery()) {
        this.searchQuery.set(serviceQuery);
      }
    });
    // Sync searchQuery with FileParseService filterQuery
    effect(() => {
      const currentFilterQuery = this.fileParse.filterQuery();
      if (currentFilterQuery !== this.searchQuery()) {
        this.searchQuery.set(currentFilterQuery);
      }
    });
  }

  public onSearchInput(value: string): void {
    // Just update the input value, don't trigger search
    this.searchQuery.set(value);
    this.searchService.setQuery(value);
    this.valueChange.emit(value);
  }

  public onSearchSubmit(value: string): void {
    const trimmedQuery = value.trim();
    console.log('[AnalyseLogTable] Search submitted:', trimmedQuery);
    this.searchQuery.set(trimmedQuery);
    this.searchService.setQuery(trimmedQuery);
    this.formatCache.clear();
    this.fileParse.setFilterQuery(trimmedQuery);
    this.searchSubmit.emit(trimmedQuery);
  }

  public onSearchClear(): void {
    this.searchQuery.set('');
    this.searchService.setQuery('');
    this.formatCache.clear();
    this.fileParse.setFilterQuery('');
    this.clear.emit();
  }

  public onOpenHelp(): void {
    this.dialog.open(QueryHelpDialog, {
      width: '90vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'query-help-dialog-container',
    });
  }

  /**
   * Format timestamp using normalized entry structure
   * Converts epoch milliseconds to localized string
   */
  public formatTimestamp(row: ParsedLogEntry): string {
    return this.getFormattedEntry(row).timestamp;
  }

  /**
   * Format log level using normalized entry structure
   * Returns: trace, debug, info, warn, error, fatal, or unknown
   */
  public formatLevel(row: ParsedLogEntry): string {
    return this.getFormattedEntry(row).level;
  }

  /**
   * Format log message using normalized entry structure
   * Extracts message from format-specific fields
   */
  public formatMessage(row: ParsedLogEntry): string {
    return this.getFormattedEntry(row).message;
  }

  /**
   * Get environment for the log entry using normalized structure
   */
  public formatEnvironment(row: ParsedLogEntry): string {
    return this.getFormattedEntry(row).environment;
  }

  public formatSource(row: ParsedLogEntry): string {
    return this.getFormattedEntry(row).source;
  }

  // Pagination controls
  public goToPage(page: number): void {
    const max = this.totalPages();
    if (page < 1) this.currentPage.set(1);
    else if (page > max) this.currentPage.set(max);
    else this.currentPage.set(page);
  }

  public nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  public prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  public handlePageEvent(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  /**
   * Get or compute formatted entry values with memoization
   */
  private getFormattedEntry(row: ParsedLogEntry): FormattedEntry {
    let cached = this.formatCache.get(row);
    if (!cached) {
      // Implement cache size limit to prevent memory issues with large datasets
      if (this.formatCache.size >= this.MAX_CACHE_SIZE) {
        // Remove oldest entries (first entries in the Map)
        const iterator = this.formatCache.keys();
        for (let i = 0; i < 1000; i++) {
          const key = iterator.next().value;
          if (key) this.formatCache.delete(key);
        }
      }

      cached = {
        timestamp: this.computeTimestamp(row),
        level: this.computeLevel(row),
        message: this.computeMessage(row),
        environment: this.computeEnvironment(row),
        source: formatSourceForIndex(row),
      };
      this.formatCache.set(row, cached);
    }
    return cached;
  }

  private computeTimestamp(row: ParsedLogEntry): string {
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

  private computeLevel(row: ParsedLogEntry): string {
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

  private computeMessage(row: ParsedLogEntry): string {
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

  private computeEnvironment(row: ParsedLogEntry): string {
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
}
