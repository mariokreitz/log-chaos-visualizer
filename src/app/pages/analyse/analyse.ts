import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  protected readonly renderProgress = signal(0);
  protected readonly isFullyRendered = signal(false);
  // Check if any data is available
  protected readonly hasData = computed(() => this.allEntries().length > 0);
  // Total count for display (always show full count)
  protected readonly totalEntryCount = computed(() => {
    const filtered = this.filteredEntries();
    const all = filtered !== null ? filtered : this.allEntries();
    return all.length;
  });
  // Loading state for better UX (used in template)
  protected readonly isLoading = computed(() => {
    return this.isParsing() || (this.isSearching() && this.tableEntries().length === 0);
  });
  private readonly fileParse = inject(FileParseService);
  protected readonly allEntries = this.fileParse.allEntries;
  protected readonly filteredEntries = this.fileParse.filteredEntries;
  protected readonly isSearching = this.fileParse.isSearching;
  protected readonly isParsing = this.fileParse.isParsing;
  private readonly router = inject(Router);
  private readonly featureFlags = inject(FeatureFlagsService);
  readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;
  // Progressive rendering configuration
  private readonly INITIAL_CHUNK_SIZE = 100; // Show first 100 entries immediately
  // Table entries with progressive loading - only show initial chunk, then load rest
  protected readonly tableEntries = computed(() => {
    const filtered = this.filteredEntries();
    const all = filtered !== null ? filtered : this.allEntries();

    // If we're still loading progressively, return only the chunk
    if (!this.isFullyRendered() && all.length > this.INITIAL_CHUNK_SIZE) {
      const progress = this.renderProgress();
      const chunkSize = Math.min(all.length, this.INITIAL_CHUNK_SIZE + progress);
      return all.slice(0, chunkSize);
    }

    return all;
  });

  constructor() {
    // Progressive rendering effect - load data in chunks
    effect(() => {
      const allData = this.filteredEntries() ?? this.allEntries();

      if (allData.length > this.INITIAL_CHUNK_SIZE && !this.isFullyRendered()) {
        // Reset rendering state
        this.renderProgress.set(0);
        this.isFullyRendered.set(false);

        // Schedule progressive loading
        this.loadRemainingChunks(allData.length);
      } else if (allData.length <= this.INITIAL_CHUNK_SIZE) {
        // Small dataset, no need for progressive loading
        this.isFullyRendered.set(true);
      }
    });

    // Log performance metrics in development
    effect(() => {
      const entries = this.tableEntries();
      if (entries.length > 0) {
        const now = performance.now();
        console.log(`[Analyse] Rendered ${entries.length} of ${this.totalEntryCount()} entries at ${now.toFixed(2)}ms`);
      }
    });
  }

  /**
   * Handle dismissing the experimental warning
   */
  protected onDismissExperimentalWarning(): void {
    this.showExperimentalWarning.set(false);
  }

  /**
   * Navigate to dashboard to upload files
   */
  protected goToDashboard(): void {
    this.router.navigate(['/']);
  }

  /**
   * Load remaining data chunks progressively using requestIdleCallback
   */
  private loadRemainingChunks(totalSize: number): void {
    const CHUNK_SIZE = 1000; // Load 1000 more entries per chunk
    let currentProgress = 0;

    const loadNextChunk = () => {
      currentProgress += CHUNK_SIZE;
      this.renderProgress.set(currentProgress);

      if (this.INITIAL_CHUNK_SIZE + currentProgress < totalSize) {
        // More chunks to load
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => loadNextChunk(), { timeout: 50 });
        } else {
          setTimeout(() => loadNextChunk(), 0);
        }
      } else {
        // All data loaded
        this.isFullyRendered.set(true);
        console.log(`[Analyse] Fully rendered ${totalSize} entries`);
      }
    };

    // Start loading chunks after initial render
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loadNextChunk(), { timeout: 50 });
    } else {
      setTimeout(() => loadNextChunk(), 0);
    }
  }
}
