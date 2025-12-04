export type WinstonEntry = {
    timestamp: string; // ISO
    level: 'silly' | 'debug' | 'verbose' | 'info' | 'warn' | 'error';
    message: string;
    meta?: {
        requestId?: string;
        userId?: string | number;
        traceId?: string;
        [k: string]: unknown;
    };
}

