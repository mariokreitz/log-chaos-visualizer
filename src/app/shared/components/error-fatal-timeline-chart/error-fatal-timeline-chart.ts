import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { ErrorFatalTimelineSummary } from '../../../core/types/file-parse.types';

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
    readonly title = input<string>('Error/Fatal peaks over time');
    readonly ariaLabel = input<string>('Timeline of error and fatal log entries, highlighting peak periods');

    readonly hasData = computed(() => {
        const summary = this.summary();
        if (!summary) {
            return false;
        }
        return summary.buckets.some(bucket => bucket.total > 0);
    });

    readonly chartData = computed<ChartData<'line'>>(() => {
        const summary = this.summary();
        if (!summary || summary.buckets.length === 0) {
            return {
                labels: [],
                datasets: [],
            };
        }

        const labels = summary.buckets.map(bucket => this.formatBucketLabel(bucket.bucketStartMs, bucket.bucketEndMs));

        const errorData = summary.buckets.map(bucket => bucket.errorCount);
        const fatalData = summary.buckets.map(bucket => bucket.fatalCount);

        const peakMask = new Set(summary.topPeakBucketIndices);
        const peakMarkerData = summary.buckets.map((bucket, index) => (peakMask.has(index) ? bucket.total : null));

        return {
            labels,
            datasets: [
                {
                    label: 'Error',
                    data: errorData,
                    borderColor: '#E53935',
                    backgroundColor: '#E53935',
                    tension: 0.2,
                    pointRadius: 2,
                },
                {
                    label: 'Fatal',
                    data: fatalData,
                    borderColor: '#8E24AA',
                    backgroundColor: '#8E24AA',
                    tension: 0.2,
                    pointRadius: 2,
                },
                {
                    label: 'Peaks',
                    data: peakMarkerData,
                    borderColor: '#FFEB3B',
                    backgroundColor: '#FFEB3B',
                    pointRadius: 5,
                    pointStyle: 'triangle',
                    showLine: false,
                },
            ],
        };
    });

    readonly chartOptions: ChartConfiguration<'line'>['options'] = {
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
                        if (!items.length) {
                            return '';
                        }
                        return String(items[0].label ?? '');
                    },
                    label: context => {
                        const label = context.dataset.label ?? '';
                        const value = context.parsed.y;
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
