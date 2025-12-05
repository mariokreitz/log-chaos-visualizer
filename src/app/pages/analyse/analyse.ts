import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { FileParseService } from '../../core/services/file-parse.service';
import { AnalyseLogTable } from '../../shared/components/analyse-log-table/analyse-log-table';

@Component({
  selector: 'app-analyse',
  imports: [AnalyseLogTable],
  templateUrl: './analyse.html',
  styleUrl: './analyse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Analyse {
  private readonly fileParse = inject(FileParseService);
  protected allEntries = this.fileParse.allEntries;
  private readonly featureFlags = inject(FeatureFlagsService);
  readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;
}
