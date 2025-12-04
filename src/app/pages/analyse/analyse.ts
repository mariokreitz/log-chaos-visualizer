import { ChangeDetectionStrategy, Component } from '@angular/core';
import { APP_CONFIG } from '../../core/config/app-config';

@Component({
    selector: 'app-analyse',
    imports: [],
    templateUrl: './analyse.html',
    styleUrl: './analyse.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Analyse {
    readonly featureFlags = APP_CONFIG.featureFlags;
}
