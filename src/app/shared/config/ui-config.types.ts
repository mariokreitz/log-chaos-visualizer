export interface SnackbarConfig {
  durationMs: number;
  horizontalPosition: 'start' | 'center' | 'end' | 'left' | 'right';
  verticalPosition: 'top' | 'bottom';
  ariaLive: 'polite' | 'assertive';
}

export interface ProgressUiConfig {
  ariaLabel: string;
}

export interface DialogConfig {
  fileSelectWidth: string;
}

export interface UiConfig {
  snackbar: SnackbarConfig;
  progress: ProgressUiConfig;
  dialog: DialogConfig;
}
