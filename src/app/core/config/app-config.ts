import { environment } from '../../../environments/environment';
import { NAV_ITEMS } from '../constants/navigation';
import { CoreAppConfig } from '../types/app-config.types';

export const APP_CONFIG: CoreAppConfig = {
  metadata: {
    title: environment.app.name,
    description: environment.app.description,
    version: environment.app.version,
    repositoryUrl: environment.app.repositoryUrl,
  },
  storage: {
    userPreferencesKey: environment.storage.userPreferencesKey,
  },
  parsing: {
    defaultSpeed: 'normal',
    presets: {
      slow: {
        chunkSize: 256 * 1024,
        delayMs: 300,
      },
      normal: {
        chunkSize: 512 * 1024,
        delayMs: 100,
      },
      fast: {
        chunkSize: 2 * 1024 * 1024,
        delayMs: 0,
      },
    },
  },
  navigation: {
    navItems: NAV_ITEMS,
    defaultRoute: '/',
  },
  featureFlags: {
    experimentalAnalysis: environment.featureFlags.experimentalAnalysis,
    debugParsing: environment.featureFlags.debugParsing,
  },
};
