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
  {
    id: 3,
    label: 'Settings',
    route: '/settings',
    icon: 'settings',
    ariaLabel: 'Go to settings',
    exact: true,
  },
  {
    id: 4,
    label: 'Help Me',
    route: '/help',
    icon: 'help',
    ariaLabel: 'Go to help',
    exact: true,
  },
  {
    id: 5,
    label: 'About',
    route: '/about',
    icon: 'info',
    ariaLabel: 'Go to about',
    exact: true,
  },
] as const;
