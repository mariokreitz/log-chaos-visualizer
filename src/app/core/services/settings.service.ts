import { Injectable, signal } from '@angular/core';
import { SETTINGS_DEFAULTS } from '../../shared/config/settings-config';
import type { ParsingSpeed, ProgressBarSettings } from '../../shared/config/settings-config.types';

@Injectable({ providedIn: 'root' })
export class SettingsService {
    readonly parsingSpeed = signal<ParsingSpeed>(SETTINGS_DEFAULTS.parsingSpeed);
    readonly progressBarSettings = signal<ProgressBarSettings>(SETTINGS_DEFAULTS.progressBar);

    setParsingSpeed(value: ParsingSpeed): void {
        this.parsingSpeed.set(value);
    }

    setProgressBarSettings(partial: Partial<ProgressBarSettings>): void {
        this.progressBarSettings.update((prev) => ({ ...prev, ...partial }));
    }
}

