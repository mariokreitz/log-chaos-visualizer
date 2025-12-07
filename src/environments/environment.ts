export const environment = {
  production: false,
  app: {
    name: 'Log Chaos Visualizer',
    description: 'Visualize and analyse logs from various formats.',
    version: '0.0.2-dev',
    repositoryUrl: 'https://github.com/mariokreitz/log-chaos-visualizer',
  },
  storage: {
    userPreferencesKey: 'log-chaos-preferences',
  },
  featureFlags: {
    experimentalAnalysis: true,
    debugParsing: true,
  },
} as const;
