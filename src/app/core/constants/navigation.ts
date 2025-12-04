import type { NavItems } from '../types/navigation';

export const NAV_ITEMS: NavItems = [
    {
        id: 1,
        label: 'Dashboard',
        route: '/',
        icon: 'dashboard',
        ariaLabel: 'Go to dashboard',
        exact: true,
    },
    {
        id: 2,
        label: 'Analyse',
        route: '/analyse',
        icon: 'analytics',
        ariaLabel: 'Go to analyse',
        exact: true,
    },
] as const;

