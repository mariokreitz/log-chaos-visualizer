export const environment = {
  production: false,
  app: {
    name: 'Log Chaos Visualizer (Dev)',
    description: 'Visualize and analyse logs from various formats in development.',
    version: '0.0.2-dev',
    repositoryUrl: 'https://github.com/mariokreitz/log-chaos-visualizer',
  },
  storage: {
    userPreferencesKey: 'log-chaos-preferences-dev',
  },
  featureFlags: {
    experimentalAnalysis: true,
    debugParsing: true,
  },
} as const;
