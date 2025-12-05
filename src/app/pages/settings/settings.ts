import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  imports: [MatRadioModule, MatSlideToggleModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Settings {
  readonly speedLabel = computed(() => {
    const value = this.speed();
    if (value === 'slow') return 'Slow';
    if (value === 'normal') return 'Normal';
    return 'Fast';
  });
  private readonly settings = inject(SettingsService);
  readonly speed = this.settings.parsingSpeed;
  readonly progressBarSettings = this.settings.progressBarSettings;
  private readonly featureFlags = inject(FeatureFlagsService);
  readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;
  readonly isProduction = this.featureFlags.isProduction;

  onSpeedChange(value: string | null): void {
    if (value === 'slow' || value === 'normal' || value === 'fast') {
      this.settings.setParsingSpeed(value);
    }
  }

  onToggleProgressBar(enabled: boolean | null): void {
    if (enabled === null) return;
    this.settings.setProgressBarSettings({ enabled });
  }

  onProgressBarSizeChange(value: string | null): void {
    if (value === 'thin' || value === 'normal') {
      this.settings.setProgressBarSettings({ size: value });
    }
  }

  onToggleExperimentalAnalysis(enabled: boolean | null): void {
    if (enabled === null) return;
    this.featureFlags.setExperimentalAnalysis(enabled);
  }
}
