import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./core/layout/layout').then(m => m.Layout),
        children: [
            {
                path: '',
                loadComponent: () => import('./pages/dashboard/dashboard'),
            },
            {
                path: 'upload',
                loadComponent: () => import('./pages/upload/upload'),
            },
            {
                path: 'analyse',
                loadComponent: () => import('./pages/analyse/analyse'),
            },
        ],
    },
];
