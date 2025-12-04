import { inject, Injectable, signal } from '@angular/core';
import { SETTINGS_DEFAULTS } from '../../shared/config/settings-config';
import type { ParsingSpeed, ProgressBarSettings } from '../../shared/config/settings-config.types';
import { UserPreferencesService } from './user-preferences.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly prefs = inject(UserPreferencesService);

  private readonly stored = this.prefs.load();

  readonly parsingSpeed = signal<ParsingSpeed>(this.stored?.parsingSpeed ?? SETTINGS_DEFAULTS.parsingSpeed);

  readonly progressBarSettings = signal<ProgressBarSettings>(
    this.stored?.progressBarSettings ?? SETTINGS_DEFAULTS.progressBar,
  );

  setParsingSpeed(value: ParsingSpeed): void {
    this.parsingSpeed.set(value);
    this.prefs.update({ parsingSpeed: value });
  }

  setProgressBarSettings(partial: Partial<ProgressBarSettings>): void {
    this.progressBarSettings.update((prev) => {
      const next = { ...prev, ...partial };
      this.prefs.update({ progressBarSettings: next });
      return next;
    });
  }
}
