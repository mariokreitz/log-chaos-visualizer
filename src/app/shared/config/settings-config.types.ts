export type ParsingSpeed = 'slow' | 'normal' | 'fast';

export type ProgressBarSize = 'thin' | 'normal';

export type ProgressBarSettings = {
    enabled: boolean;
    size: ProgressBarSize;
};

export type SettingsDefaultsConfig = {
    parsingSpeed: ParsingSpeed;
    progressBar: ProgressBarSettings;
};

