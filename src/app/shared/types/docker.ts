export type DockerLogLine = {
    log: string;
    stream: 'stdout' | 'stderr';
    time: string;
}

