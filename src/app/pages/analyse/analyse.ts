import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';

@Component({
  selector: 'app-analyse',
  imports: [],
  templateUrl: './analyse.html',
  styleUrl: './analyse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Analyse {
  private readonly featureFlags = inject(FeatureFlagsService);
  readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;
}
