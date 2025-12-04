import { APP_CONFIG } from '../../core/config/app-config';
import type { SettingsDefaultsConfig } from './settings-config.types';

export const SETTINGS_DEFAULTS: SettingsDefaultsConfig = {
  parsingSpeed: APP_CONFIG.parsing.defaultSpeed,
  progressBar: {
    enabled: true,
    size: 'normal',
  },
};
