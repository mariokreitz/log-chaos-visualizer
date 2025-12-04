import { computed, Injectable, signal } from '@angular/core';
import { NAV_ITEMS } from '../constants/navigation';
import type { NavItems } from '../types/navigation';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    readonly items = signal<NavItems>(NAV_ITEMS);
    readonly visibleItems = computed(() => this.items().filter(i => i.visible !== false));

}
