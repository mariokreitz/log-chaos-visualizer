import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchService } from '../../../core/services/search.service';

export interface QuickFilter {
  label: string;
  query: string;
  description: string;
  icon: string;
  category: 'level' | 'environment' | 'common' | 'advanced';
}

@Component({
  selector: 'app-quick-filters',
  imports: [MatChipsModule, MatIconModule, MatTooltipModule],
  templateUrl: './quick-filters.html',
  styleUrls: ['./quick-filters.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickFilters {
  protected readonly quickFilters: QuickFilter[] = [
    // Level-based filters
    {
      label: 'Errors Only',
      query: 'level=error',
      description: 'Show all error level logs',
      icon: 'error',
      category: 'level',
    },
    {
      label: 'Errors & Fatal',
      query: 'level=error OR level=fatal',
      description: 'Show critical issues (errors and fatal)',
      icon: 'warning',
      category: 'level',
    },
    {
      label: 'Warnings',
      query: 'level=warn',
      description: 'Show all warning level logs',
      icon: 'warning_amber',
      category: 'level',
    },
    {
      label: 'Info & Above',
      query: 'level=info OR level=warn OR level=error OR level=fatal',
      description: 'Hide debug and trace logs',
      icon: 'info',
      category: 'level',
    },

    // Environment-based filters
    {
      label: 'Production Only',
      query: 'environment=prod',
      description: 'Show only production environment logs',
      icon: 'cloud',
      category: 'environment',
    },
    {
      label: 'Prod Errors',
      query: 'level=error AND environment=prod',
      description: 'Critical: Production errors',
      icon: 'error_outline',
      category: 'environment',
    },
    {
      label: 'Non-Production',
      query: 'environment=dev OR environment=staging',
      description: 'Development and staging environments',
      icon: 'code',
      category: 'environment',
    },

    // Common issue patterns
    {
      label: 'Timeouts',
      query: 'contains(message, "timeout")',
      description: 'Find timeout-related issues',
      icon: 'schedule',
      category: 'common',
    },
    {
      label: 'API Errors',
      query: 'contains(message, "api") AND level=error',
      description: 'API-related errors',
      icon: 'api',
      category: 'common',
    },
    {
      label: 'Database Issues',
      query: 'contains(message, "database") OR contains(message, "db") OR contains(message, "sql")',
      description: 'Database connection or query issues',
      icon: 'storage',
      category: 'common',
    },
    {
      label: 'Exceptions',
      query: 'contains(message, "exception") OR contains(message, "error")',
      description: 'Find exception traces',
      icon: 'bug_report',
      category: 'common',
    },
    {
      label: 'HTTP 5xx',
      query: 'statusCode>=500',
      description: 'Server errors (500-599)',
      icon: 'http',
      category: 'common',
    },

    // Advanced filters
    {
      label: 'Failed Requests',
      query: '(statusCode>=400 AND statusCode<600) OR contains(message, "failed")',
      description: 'HTTP errors or failed operations',
      icon: 'close',
      category: 'advanced',
    },
    {
      label: 'Authentication',
      query: 'contains(message, "auth") OR contains(message, "login") OR contains(message, "unauthorized")',
      description: 'Authentication-related logs',
      icon: 'lock',
      category: 'advanced',
    },
    {
      label: 'Retries',
      query: 'contains(message, "retry") OR contains(message, "attempt")',
      description: 'Operations being retried',
      icon: 'refresh',
      category: 'advanced',
    },
  ];
  private readonly searchService = inject(SearchService);

  protected onFilterClick(filter: QuickFilter): void {
    this.searchService.setQuery(filter.query);
  }
}
