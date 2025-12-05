import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  private readonly fileParse = inject(FileParseService);
  protected readonly allEntries = this.fileParse.allEntries;
  protected readonly filteredEntries = this.fileParse.filteredEntries;
  protected readonly tableEntries = computed(() => this.filteredEntries() ?? this.allEntries());
  protected readonly isSearching = this.fileParse.isSearching;
  private readonly featureFlags = inject(FeatureFlagsService);
  readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;

  /**
   * Handle dismissing the experimental warning
   */
  protected onDismissExperimentalWarning(): void {
    this.showExperimentalWarning.set(false);
  }
}
