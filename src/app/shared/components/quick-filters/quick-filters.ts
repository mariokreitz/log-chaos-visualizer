import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  public readonly filterSelected = output<string>();

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
      query: 'message.contains(timeout)',
      description: 'Find timeout-related issues',
      icon: 'schedule',
      category: 'common',
    },
    {
      label: 'API Errors',
      query: 'message.contains(api) AND level=error',
      description: 'API-related errors',
      icon: 'api',
      category: 'common',
    },
    {
      label: 'Database Issues',
      query: 'message.contains(database) OR message.contains(db) OR message.contains(sql)',
      description: 'Database connection or query issues',
      icon: 'storage',
      category: 'common',
    },
    {
      label: 'Exceptions',
      query: 'message.contains(exception) OR message.contains(error)',
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
      query: '(statusCode>=400 AND statusCode<600) OR message.contains(failed)',
      description: 'HTTP errors or failed operations',
      icon: 'close',
      category: 'advanced',
    },
    {
      label: 'Authentication',
      query: 'message.contains(auth) OR message.contains(login) OR message.contains(unauthorized)',
      description: 'Authentication-related logs',
      icon: 'lock',
      category: 'advanced',
    },
    {
      label: 'Retries',
      query: 'message.contains(retry) OR message.contains(attempt)',
      description: 'Operations being retried',
      icon: 'refresh',
      category: 'advanced',
    },
  ];

  protected onFilterClick(filter: QuickFilter): void {
    this.filterSelected.emit(filter.query);
  }
}
