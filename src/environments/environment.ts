export const environment = {
    production: true,
    app: {
        name: 'Log Chaos Visualizer',
        description: 'Visualize and analyse logs from various formats.',
        version: '0.0.0-dev',
        repositoryUrl: 'https://github.com/mariokreitz/log-chaos-visualizer',
    },
    featureFlags: {
        experimentalAnalysis: false,
        debugParsing: false,
    },
} as const;

