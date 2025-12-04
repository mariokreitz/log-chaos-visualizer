import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { APP_CONFIG } from '../config/app-config';
import type { FeatureFlagsState } from '../types/feature-flags.types';
import { UserPreferencesService } from './user-preferences.service';

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  readonly isProduction = environment.production;

  private readonly prefs = inject(UserPreferencesService);
  private readonly stored = this.prefs.load();

  private readonly initial: FeatureFlagsState = {
    experimentalAnalysis:
      this.stored?.featureFlags?.experimentalAnalysis ?? APP_CONFIG.featureFlags.experimentalAnalysis,
    debugParsing: this.stored?.featureFlags?.debugParsing ?? APP_CONFIG.featureFlags.debugParsing,
  };

  readonly experimentalAnalysis = signal<boolean>(this.initial.experimentalAnalysis);
  readonly debugParsing = signal<boolean>(this.initial.debugParsing);

  setExperimentalAnalysis(enabled: boolean): void {
    this.experimentalAnalysis.set(enabled);
    this.prefs.update({ featureFlags: { experimentalAnalysis: enabled } });
  }

  setDebugParsing(enabled: boolean): void {
    this.debugParsing.set(enabled);
    this.prefs.update({ featureFlags: { debugParsing: enabled } });
  }
}
