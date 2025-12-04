export type SnackbarConfig = {
    durationMs: number;
    horizontalPosition: 'start' | 'center' | 'end' | 'left' | 'right';
    verticalPosition: 'top' | 'bottom';
    ariaLive: 'polite' | 'assertive';
};

export type ProgressUiConfig = {
    ariaLabel: string;
};

export type DialogConfig = {
    fileSelectWidth: string;
};

export type UiConfig = {
    snackbar: SnackbarConfig;
    progress: ProgressUiConfig;
    dialog: DialogConfig;
};
