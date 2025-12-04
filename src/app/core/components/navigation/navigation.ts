import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV_ITEMS } from '../../constants/navigation';

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
    readonly items = signal(NAV_ITEMS);
    readonly visibleItems = computed(() => this.items().filter(i => i.visible !== false));
}
