import { Injectable, signal } from '@angular/core';

export type ParsingSpeed = 'slow' | 'normal' | 'fast';

export type ProgressBarSize = 'thin' | 'normal';

export type ProgressBarSettings = {
    enabled: boolean;
    size: ProgressBarSize;
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
    readonly parsingSpeed = signal<ParsingSpeed>('slow');
    readonly progressBarSettings = signal<ProgressBarSettings>({
        enabled: true,
        size: 'normal',
    });

    setParsingSpeed(value: ParsingSpeed): void {
        this.parsingSpeed.set(value);
    }

    setProgressBarSettings(partial: Partial<ProgressBarSettings>): void {
        this.progressBarSettings.update((prev) => ({ ...prev, ...partial }));
    }
}
