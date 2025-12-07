import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly _query = signal<string>('');
  readonly query = this._query.asReadonly();

  private readonly router: Router = inject(Router);

  constructor() {
    const urlQuery = this.getQueryFromUrl();
    if (urlQuery) {
      this._query.set(urlQuery);
    }
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
}
