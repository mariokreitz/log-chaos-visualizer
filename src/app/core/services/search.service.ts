import { effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { ParsedLogEntry } from '../types/file-parse.types';
import { evaluateQuery } from '../utils/query-evaluator';
import { parseQuery } from '../utils/query-parser';
import { FileParseService } from './file-parse.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly _query = signal<string>('');
  readonly query = this._query.asReadonly();

  private readonly _filteredEntries = signal<ParsedLogEntry[] | null>(null);
  readonly filteredEntries = this._filteredEntries.asReadonly();

  private readonly _isSearching = signal(false);
  readonly isSearching = this._isSearching.asReadonly();

  private readonly _lastSearchDurationMs = signal<number | null>(null);
  readonly lastSearchDurationMs = this._lastSearchDurationMs.asReadonly();

  private readonly _lastSearchResultCount = signal<number | null>(null);
  readonly lastSearchResultCount = this._lastSearchResultCount.asReadonly();

  private readonly router: Router = inject(Router);
  private readonly fileParse = inject(FileParseService);

  constructor() {
    const urlQuery = this.getQueryFromUrl();
    if (urlQuery) {
      this._query.set(urlQuery);
    }
    // Effect: execute query whenever it changes or allEntries change
    effect(() => {
      this.executeQuery(this._query());
    });
  }

  setQuery(query: string): void {
    this._query.set(query);
    this.setQueryInUrl(query);
  }

  private getQueryFromUrl(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get('query') ?? '';
  }

  private setQueryInUrl(query: string): void {
    this.router.navigate([], {
      queryParams: { query: query || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private executeQuery(query: string): void {
    const startTime = performance.now();
    this._isSearching.set(true);
    const allEntries = this.fileParse.allEntries();
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      this._filteredEntries.set(allEntries);
      this._lastSearchResultCount.set(allEntries.length);
      this._lastSearchDurationMs.set(performance.now() - startTime);
      this._isSearching.set(false);
      return;
    }
    const parsedQuery = parseQuery(normalized);
    if (!parsedQuery.isLegacyTextSearch && parsedQuery.ast) {
      if (parsedQuery.errors.length > 0) {
        this._filteredEntries.set([]);
        this._lastSearchResultCount.set(0);
        this._lastSearchDurationMs.set(performance.now() - startTime);
        this._isSearching.set(false);
        return;
      }
      // Use evaluateQuery for structured queries
      const result = evaluateQuery(parsedQuery.ast, {
        entries: allEntries,
        indexer: undefined, // Use indexer if available
      });
      const filtered = result.matchedIndices.map((idx: number) => allEntries[idx]);
      this._filteredEntries.set(filtered as ParsedLogEntry[]);
      this._lastSearchResultCount.set(filtered.length);
      this._lastSearchDurationMs.set(performance.now() - startTime);
      this._isSearching.set(false);
      return;
    }
    // Legacy text search fallback
    const filtered = allEntries.filter((entry: ParsedLogEntry) => {
      // Simple string match on entry (customize as needed)
      return JSON.stringify(entry).toLowerCase().includes(normalized);
    });
    this._filteredEntries.set(filtered);
    this._lastSearchResultCount.set(filtered.length);
    this._lastSearchDurationMs.set(performance.now() - startTime);
    this._isSearching.set(false);
  }
}
