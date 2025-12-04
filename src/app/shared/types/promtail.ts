export type PromtailTextLine = {
    ts: string; // ISO timestamp
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string; // text message with key=value pairs
}

