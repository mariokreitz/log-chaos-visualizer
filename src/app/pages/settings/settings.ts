import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { SettingsService } from '../../shared/services/settings.service';

@Component({
    selector: 'app-settings',
    imports: [ MatRadioModule ],
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

    onSpeedChange(value: string | null): void {
        if (value === 'slow' || value === 'normal' || value === 'fast') {
            this.settings.setParsingSpeed(value);
        }
    }
}

