import { CdkVirtualScrollViewport, ScrollingModule, VIRTUAL_SCROLL_STRATEGY } from '@angular/cdk/scrolling';
import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  signal,
  ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SearchService } from '../../../core/services/search.service';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';
import { MeasuredVirtualScrollStrategy } from '../../virtual-scroll/measured-virtual-scroll.strategy';
import { AnalyseDetailView } from '../analyse-detail-view/analyse-detail-view';
import { QueryHelpDialog } from '../query-help-dialog/query-help-dialog';
import { SearchInput } from '../search-input/search-input';

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
    AnalyseDetailView,
  ],
  providers: [{ provide: VIRTUAL_SCROLL_STRATEGY, useClass: MeasuredVirtualScrollStrategy }],
  templateUrl: './analyse-log-table.html',
  styleUrls: ['./analyse-log-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseLogTable {
  public readonly entries: InputSignal<ParsedLogEntry[]> = input.required<ParsedLogEntry[]>();
  public readonly isSearching: InputSignal<boolean> = input(false);
  // Virtual scroll configuration - optimized for performance
  public readonly minBufferPx = 100;
  public readonly maxBufferPx = 300;
  // Loading state management
  public shouldShowEmpty = computed(() => this.entries().length === 0 && !this.isSearching());
  public readonly currentPage = signal<number>(1);
  // Pagination state
  public pageSize = signal<number>(2000);
  public readonly pageSizeOptions = [2000, 5000, 10000];
  public readonly showFirstLastButtons = true;
  public readonly paginatedEntries = computed(() => {
    const all = this.entries();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    const end = start + size;
    return all.slice(start, end);
  });
  // Selection state for inline detail expansion (Option A)
  public readonly selectedIndex = signal<number | null>(null);
  public readonly selectedEntry = computed<ParsedLogEntry | null>(() => {
    const idx = this.selectedIndex();
    return idx === null ? null : (this.paginatedEntries()[idx] ?? null);
  });
  // Keep the base row height as a constant and expose itemSize as a signal for runtime updates
  private readonly baseItemSize = 48;
  public readonly itemSize = signal<number>(this.baseItemSize);
  // Track focus and last selected index to restore focus on close
  private previousFocus: HTMLElement | null = null;
  private lastSelectedIndex: number | null = null;

  private readonly search = inject(SearchService);
  protected readonly query = this.search.query;
  public readonly lastSearchDurationMs = this.search.lastSearchDurationMs;
  public readonly lastSearchResultCount = this.search.lastSearchResultCount;
  private readonly dialog = inject(MatDialog);
  // Viewport reference so we can ensure selected row is visible before opening details
  @ViewChild(CdkVirtualScrollViewport, { static: false }) private viewport?: CdkVirtualScrollViewport;

  public onOpenHelp(): void {
    this.dialog.open(QueryHelpDialog, {
      width: '90vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'query-help-dialog-container',
    });
  }

  /**
   * Select a row (by entry and index inside the current paginatedEntries).
   * Ensures the selected row is scrolled into view and the inline detail can be focused.
   */
  public selectEntry(entry: ParsedLogEntry, index: number): void {
    // Save currently focused element so we can restore focus when closing
    try {
      this.previousFocus = (document.activeElement as HTMLElement) ?? null;
    } catch {
      this.previousFocus = null;
    }

    // If clicking the already-selected row, toggle close
    if (this.selectedIndex() === index) {
      this.clearSelection();
      return;
    }

    this.selectedIndex.set(index);
    this.lastSelectedIndex = index;

    // Ensure the row is visible in the viewport. Schedule after microtask so the index is set.
    queueMicrotask(() => {
      try {
        this.viewport?.scrollToIndex(index, 'smooth');
      } catch {
        // ignore
      }

      // Give Angular a small tick to render the expanded content, then measure and focus it.
      setTimeout(() => {
        try {
          const detailEl = document.getElementById(`detail-${index}`);
          if (detailEl) {
            // Measure the new height of the row + detail and set itemSize accordingly (approximation)
            const measuredHeight = detailEl.getBoundingClientRect().height || this.baseItemSize;
            const newSize = Math.max(this.baseItemSize, measuredHeight);
            this.itemSize.set(newSize);
          }

          // Focus first interactive element inside the detail, or the detail itself
          const focusEl = detailEl?.querySelector('[data-focus-first]') as HTMLElement | null;
          (focusEl ?? (detailEl as HTMLElement | null))?.focus?.();
        } catch {
          // ignore focus/measurement errors
        }

        try {
          this.viewport?.checkViewportSize();
        } catch {
          // ignore
        }
      }, 120);
    });
  }

  public clearSelection(): void {
    const lastIndex = this.lastSelectedIndex;

    this.selectedIndex.set(null);
    this.lastSelectedIndex = null;

    // restore default size and ask viewport to recalc
    this.itemSize.set(this.baseItemSize);
    queueMicrotask(() => {
      try {
        this.viewport?.checkViewportSize();
      } catch {
        // ignore
      }

      // Try to restore previous focus; if not possible, focus the previously selected row
      try {
        const prev = this.previousFocus;
        if (prev && document.body.contains(prev)) {
          prev.focus();
          return;
        }
      } catch {
        // ignore
      }

      if (lastIndex !== null) {
        try {
          const rowEl = document.getElementById(`row-${lastIndex}`) as HTMLElement | null;
          rowEl?.focus?.();
        } catch {
          // ignore
        }
      }
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
   * Format log message using normalized entry structure
   * Extracts message from format-specific fields
   */
  public formatMessage(row: ParsedLogEntry): string {
    return this.getFormattedEntry(row).message;
  }

  /**
   * Get environment for the log entry using normalized structure
   */
  public formatSource(row: ParsedLogEntry): string {
    return this.getFormattedEntry(row).source;
  }

  public handlePageEvent(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    // Reset selection when changing page to avoid stale indices
    this.clearSelection();
  }

  /**
   * Get or compute formatted entry values with memoization
   */
  private getFormattedEntry(row: ParsedLogEntry): FormattedEntry {
    const normalized = row.normalized ?? {};
    return {
      timestamp: normalized.timestamp ? new Date(normalized.timestamp).toLocaleString() : '',
      level: normalized.level ? normalized.level.toUpperCase() : '',
      message: normalized.message ?? '',
      environment: normalized.environment ?? 'N/A',
      source: normalized.kind ?? 'unknown',
    };
  }
}
