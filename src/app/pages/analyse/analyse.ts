import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { FileParseService } from '../../core/services/file-parse.service';
import { AnalyseLogTable } from '../../shared/components/analyse-log-table/analyse-log-table';
import { WarningBanner } from '../../shared/components/warning-banner/warning-banner';

@Component({
  selector: 'app-analyse',
  imports: [AnalyseLogTable, WarningBanner],
  templateUrl: './analyse.html',
  styleUrl: './analyse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Analyse {
  // Warning banner state
  protected readonly showExperimentalWarning = signal(true);
  // Optimize table entries computation - only recalculate when necessary
  protected readonly tableEntries = computed(() => {
    const filtered = this.filteredEntries();
    return filtered !== null ? filtered : this.allEntries();
  });
  // Loading state for better UX
  protected readonly isLoading = computed(() => {
    return this.isParsing() || (this.isSearching() && this.tableEntries().length === 0);
  });
  private readonly fileParse = inject(FileParseService);
  protected readonly allEntries = this.fileParse.allEntries;
  protected readonly filteredEntries = this.fileParse.filteredEntries;
  protected readonly isSearching = this.fileParse.isSearching;
  protected readonly isParsing = this.fileParse.isParsing;
  private readonly featureFlags = inject(FeatureFlagsService);
  readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;

  constructor() {
    // Log performance metrics in development
    effect(() => {
      const entries = this.tableEntries();
      if (entries.length > 0) {
        const now = performance.now();
        console.log(`[Analyse] Rendered ${entries.length} entries at ${now.toFixed(2)}ms`);
      }
    });
  }

  /**
   * Handle dismissing the experimental warning
   */
  protected onDismissExperimentalWarning(): void {
    this.showExperimentalWarning.set(false);
  }
}
