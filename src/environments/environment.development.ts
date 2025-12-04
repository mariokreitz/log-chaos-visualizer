export const environment = {
    production: false,
    app: {
        name: 'Log Chaos Visualizer (Dev)',
        description: 'Visualize and analyse logs from various formats in development.',
        version: '0.0.0-dev',
        repositoryUrl: 'https://github.com/mariokreitz/log-chaos-visualizer',
    },
    featureFlags: {
        experimentalAnalysis: true,
        debugParsing: true,
    },
} as const;

