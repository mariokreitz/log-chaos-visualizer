import { Routes } from '@angular/router';
import { dataReadyGuard } from './core/guards/data-ready.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/layout').then((m) => m.Layout),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard'),
      },
      {
        path: 'analyse',
        loadComponent: () => import('./pages/analyse/analyse'),
        canActivate: [dataReadyGuard],
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings'),
      },
      {
        path: 'about',
        loadComponent: () => import('./pages/about/about'),
      },
      {
        path: 'help',
        loadComponent: () => import('./pages/help-me/help-me'),
      },
    ],
  },
];
