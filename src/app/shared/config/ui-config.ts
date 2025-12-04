import type { UiConfig } from './ui-config.types';

export const UI_CONFIG: UiConfig = {
  snackbar: {
    durationMs: 4000,
    horizontalPosition: 'right',
    verticalPosition: 'top',
    ariaLive: 'polite',
  },
  progress: {
    ariaLabel: 'Global log parsing progress',
  },
  dialog: {
    fileSelectWidth: '400px',
  },
};
