import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { ExperimentalLogTable } from './experimental-log-table/experimental-log-table';

@Component({
  selector: 'app-analyse',
  imports: [ExperimentalLogTable],
  templateUrl: './analyse.html',
  styleUrl: './analyse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Analyse {
  private readonly featureFlags = inject(FeatureFlagsService);
  readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;
}
