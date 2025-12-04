import { Injectable, signal } from '@angular/core';

export type ParsingSpeed = 'slow' | 'normal' | 'fast';

@Injectable({ providedIn: 'root' })
export class SettingsService {
    readonly parsingSpeed = signal<ParsingSpeed>('slow');

    setParsingSpeed(value: ParsingSpeed): void {
        this.parsingSpeed.set(value);
    }
}

