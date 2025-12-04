export type ParsingSpeed = 'slow' | 'normal' | 'fast';

export type ProgressBarSize = 'thin' | 'normal';

export interface ProgressBarSettings {
  enabled: boolean;
  size: ProgressBarSize;
}

export interface SettingsDefaultsConfig {
  parsingSpeed: ParsingSpeed;
  progressBar: ProgressBarSettings;
}
