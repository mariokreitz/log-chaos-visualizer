import { ScrollingModule } from '@angular/cdk/scrolling';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, InputSignal, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SearchService } from '../../../core/services/search.service';
import { ParsedLogEntry } from '../../../core/types/file-parse.types';
import type {
  ASTNode,
  BinaryExpression,
  ComparisonExpression,
  FunctionCall,
  NotExpression,
} from '../../../core/types/query-language.types';
import { extractFieldValue } from '../../../core/utils/field-extractor';
import { parseQuery } from '../../../core/utils/query-parser';
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
  ],
  templateUrl: './analyse-log-table.html',
  styleUrls: ['./analyse-log-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyseLogTable {
  public readonly entries: InputSignal<ParsedLogEntry[]> = input.required<ParsedLogEntry[]>();
  public readonly isSearching: InputSignal<boolean> = input(false);
  // Virtual scroll configuration - optimized for performance
  public readonly itemSize = 48; // Height of each row in pixels
  public readonly minBufferPx = 100; // Reduced from 200 for faster initial render
  public readonly maxBufferPx = 300; // Reduced from 400 for less memory usage
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
  private readonly search = inject(SearchService);
  protected readonly query = this.search.query;
  public readonly lastSearchDurationMs = this.search.lastSearchDurationMs;
  public readonly lastSearchResultCount = this.search.lastSearchResultCount;
  private readonly dialog = inject(MatDialog);

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

  // Pagination controls
  public handlePageEvent(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  /**
   * Returns a list of field paths (dot notation) used in the current query, or empty if not structured
   */
  public getQueriedFields(): string[] {
    const q = this.query();
    const parsed = parseQuery(q);
    if (!parsed.ast) return [];
    const fields = new Set<string>();
    function visit(node: ASTNode | null) {
      if (!node) return;
      switch (node.type) {
        case 'ComparisonExpression': {
          const cmp = node as ComparisonExpression;
          if (cmp.field?.name) fields.add(cmp.field.name);
          break;
        }
        case 'BinaryExpression': {
          const b = node as BinaryExpression;
          visit(b.left);
          visit(b.right);
          break;
        }
        case 'NotExpression': {
          const n = node as NotExpression;
          visit(n.expression);
          break;
        }
        case 'FunctionCall': {
          const f = node as FunctionCall;
          // function call may reference a field
          if (f.field?.name) fields.add(f.field.name);
          break;
        }
        default:
          break;
      }
    }
    visit(parsed.ast);
    return Array.from(fields);
  }

  /**
   * Returns a map of queried field values for a given row
   */
  public getQueriedFieldValues(row: ParsedLogEntry): Record<string, string | number | boolean | null> {
    const fields = this.getQueriedFields();
    const result: Record<string, string | number | boolean | null> = {};
    for (const field of fields) {
      result[field] = extractFieldValue(row, field);
    }
    return result;
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
