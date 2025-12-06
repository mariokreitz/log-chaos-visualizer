import { Routes } from '@angular/router';

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
