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
}

