import { computed, Injectable, signal } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';
import type { NavItems } from '../types/navigation';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  readonly items = signal<NavItems>(APP_CONFIG.navigation.navItems);
  readonly visibleItems = computed(() => this.items().filter((i) => i.visible !== false));
}
