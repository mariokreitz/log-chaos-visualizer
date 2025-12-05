import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { GlobalProgress } from '../components/global-progress/global-progress';
import { Header } from '../components/header/header';
import { Navigation } from '../components/navigation/navigation';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Header, Navigation, MatSidenavContainer, MatSidenav, MatSidenavContent, GlobalProgress],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-layout',
  },
})
export class Layout implements OnDestroy {
  readonly isSidenavOpen = signal(false);
  readonly isMobile = signal(false);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly _sub = this.breakpointObserver.observe(['(max-width: 899px)']).subscribe((state) => {
    const mobile = state.matches;
    this.isMobile.set(mobile);
    this.isSidenavOpen.set(!mobile);
  });

  private readonly router = inject(Router);
  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (this.isMobile()) {
        this.isSidenavOpen.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this._sub.unsubscribe();
  }

  toggleSidenav(): void {
    if (this.isMobile()) {
      this.isSidenavOpen.update((v) => !v);
    }
  }
}
