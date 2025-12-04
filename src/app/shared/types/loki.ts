export type LokiEntry = {
    ts: string;
    labels: {
        job: string;
        instance: string;
        app: string;
        environment: 'dev' | 'staging' | 'prod';
        [k: string]: string;
    };
    line: string;
}

