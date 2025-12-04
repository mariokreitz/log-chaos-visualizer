import { NAV_ITEMS } from '../constants/navigation';
import type { CoreAppConfig } from './app-config.types';

export const APP_CONFIG: CoreAppConfig = {
    metadata: {
        title: 'Log Chaos Visualizer',
        description: 'Visualize and analyse logs from various formats.',
        version: '0.0.0-dev',
        repositoryUrl: 'https://github.com/mariokreitz/log-chaos-visualizer',
    },
    parsing: {
        defaultSpeed: 'slow',
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
        experimentalAnalysis: false,
        debugParsing: false,
    },
};

