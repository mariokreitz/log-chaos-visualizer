import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { filter } from 'rxjs';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, MatListModule, MatIconModule],
  templateUrl: './navigation.html',
  styleUrl: './navigation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'navigation',
    'aria-label': 'Primary',
  },
})
export class Navigation implements OnDestroy {
  private readonly navService = inject(NavigationService);
  readonly visibleItems = this.navService.visibleItems;
  private readonly router = inject(Router);
  private readonly currentUrl = signal<string>(this.router.url ?? '/');
  private readonly _routerSub: Subscription;

  constructor() {
    this._routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects ?? e.url);
      });
  }

  isActive(item: { route: string; exact?: boolean }): boolean {
    const url = this.currentUrl();
    if (item.exact) return url === item.route;
    return url === item.route || url.startsWith(item.route.endsWith('/') ? item.route : `${item.route}/`);
  }

  ngOnDestroy(): void {
    this._routerSub.unsubscribe();
  }
}
