export type DockerLogLine = {
    log: string;
    stream: 'stdout' | 'stderr';
    time: string;
};

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
};

export type PinoEntry = {
    time: number; // epoch millis
    level: 10 | 20 | 30 | 40 | 50 | 60; // trace/debug/info/warn/error/fatal
    pid: number;
    hostname: string;
    name: string;
    msg: string;
    req?: {
        id: string;
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        url: string;
        remoteAddress?: string;
    };
    res?: {
        statusCode: number;
        responseTimeMs?: number;
    };
    meta?: Record<string, unknown>;
};

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
};

export type PromtailTextLine = {
    ts: string; // ISO timestamp
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string; // text message with key=value pairs
};

