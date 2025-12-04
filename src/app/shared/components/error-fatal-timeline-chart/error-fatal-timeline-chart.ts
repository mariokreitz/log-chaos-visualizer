import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { ErrorFatalTimelineSummary } from '../../../core/types/file-parse.types';

const FIVE_MIN_MS = 5 * 60 * 1000;

@Component({
    selector: 'app-error-fatal-timeline-chart',
    imports: [
        BaseChartDirective,

    ],
    templateUrl: './error-fatal-timeline-chart.html',
    styleUrl: './error-fatal-timeline-chart.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'error-fatal-timeline-chart',
        role: 'group',
        '[attr.aria-label]': 'ariaLabel()',
    },
})
export class ErrorFatalTimelineChartComponent {
    readonly summary = input<ErrorFatalTimelineSummary | null>(null);
    readonly title = input<string>('Error/Fatal timeline');
    readonly ariaLabel = input<string>('Timeline of error and fatal log entries');

    readonly hasData = computed(() => {
        const summary = this.summary();
        if (!summary) {
            return false;
        }
        return summary.buckets.some(bucket => bucket.total > 0);
    });
    readonly chartData = computed<ChartData<'bar'>>(() => {
        const summary = this.summary();
        if (!summary || summary.buckets.length === 0) {
            return {
                labels: [],
                datasets: [],
            };
        }

        const buckets = this.reBucketToFiveMinutes(summary as ErrorFatalTimelineSummary);

        const labels = buckets.map((b: any) => this.formatBucketLabel(b.start, b.end));
        const errorData = buckets.map((b: any) => b.error);
        const fatalData = buckets.map((b: any) => b.fatal);

        return {
            labels,
            datasets: [
                {
                    label: 'Error',
                    data: errorData,
                    backgroundColor: '#E53935',
                    borderColor: '#B71C1C',
                    borderWidth: 1,
                },
                {
                    label: 'Fatal',
                    data: fatalData,
                    backgroundColor: '#8E24AA',
                    borderColor: '#6A1B9A',
                    borderWidth: 1,
                },
            ],
        };
    });
    readonly chartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                },
            },
            tooltip: {
                callbacks: {
                    title: items => {
                        if (!items.length) return '';
                        return String(items[0].label ?? '');
                    },
                    label: context => {
                        const label = context.dataset.label ?? '';
                        // parsed.y works for bar chart as well
                        const value = (context.parsed as any).y ?? (context.parsed as any).v ?? 0;
                        return `${label}: ${value}`;
                    },
                },
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time',
                },
                ticks: {
                    autoSkip: true,
                    maxRotation: 0,
                    minRotation: 0,
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Count',
                },
                beginAtZero: true,
            },
        },
        animation: false,
    };

    /**
     * Aggregate incoming summary buckets into fixed 5-minute buckets.
     * If the incoming summary already uses 5-minute buckets, use them as-is.
     */
    private reBucketToFiveMinutes(summary: ErrorFatalTimelineSummary) {
        if (summary.bucketSizeMs === FIVE_MIN_MS) {
            // Already in required bucket size — return mapped buckets
            return summary.buckets.map(b => ({
                start: b.bucketStartMs,
                end: b.bucketEndMs,
                error: b.errorCount,
                fatal: b.fatalCount,
                total: b.total,
            }));
        }

        // Determine overall time range
        const minStart = Math.min(...summary.buckets.map(b => b.bucketStartMs));
        const maxEnd = Math.max(...summary.buckets.map(b => b.bucketEndMs));

        const base = Math.floor(minStart / FIVE_MIN_MS) * FIVE_MIN_MS;
        const last = Math.ceil(maxEnd / FIVE_MIN_MS) * FIVE_MIN_MS;
        const bucketCount = Math.max(0, Math.floor((last - base) / FIVE_MIN_MS));

        const buckets = Array.from({ length: bucketCount }, (_, i) => ({
            start: base + i * FIVE_MIN_MS,
            end: base + (i + 1) * FIVE_MIN_MS,
            error: 0,
            fatal: 0,
            total: 0,
        }));

        for (const b of summary.buckets) {
            // place the entire bucket into the bucket that matches its start
            const idx = Math.floor((b.bucketStartMs - base) / FIVE_MIN_MS);
            if (idx >= 0 && idx < buckets.length) {
                buckets[idx].error += b.errorCount;
                buckets[idx].fatal += b.fatalCount;
                buckets[idx].total += b.total;
            }
        }

        return buckets;
    }

    private formatBucketLabel(startMs: number, endMs: number): string {
        const start = new Date(startMs);
        const end = new Date(endMs);

        const startTime = start.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        const endTime = end.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        return `${startTime} – ${endTime}`;
    }
}
