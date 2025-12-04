import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
    selector: 'app-navigation',
    imports: [
        RouterLink,
        RouterLinkActive,
        MatListModule,
        MatIconModule,
    ],
    templateUrl: './navigation.html',
    styleUrl: './navigation.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        role: 'navigation',
        'aria-label': 'Primary',
    },
})
export class Navigation {
}
