import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { LevelSummary, NormalizedLogLevel } from '../../../core/types/file-parse.types';

const LEVELS: NormalizedLogLevel[] = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'unknown',
];

const LEVEL_LABELS: Record<NormalizedLogLevel, string> = {
    trace: 'Trace',
    debug: 'Debug',
    info: 'Info',
    warn: 'Warn',
    error: 'Error',
    fatal: 'Fatal',
    unknown: 'Unknown',
};

export type LevelCountEntry = {
    level: NormalizedLogLevel;
    label: string;
    count: number;
    percentage: number;
};

@Component({
    selector: 'app-log-level-doughnut-chart',
    imports: [
        BaseChartDirective,
        DecimalPipe,
    ],
    templateUrl: './log-level-doughnut-chart.html',
    styleUrl: './log-level-doughnut-chart.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'log-level-doughnut-chart',
        role: 'group',
        '[attr.aria-label]': 'ariaLabel()',
    },
})
export class LogLevelDoughnutChartComponent {
    readonly summary = input<LevelSummary | null>(null);
    readonly title = input<string>('Log entries by level');
    readonly ariaLabel = input<string>('Distribution of parsed log entries by log level');

    readonly totalCount = computed(() => {
        const summary = this.summary();
        return summary?.total ?? 0;
    });

    readonly entries = computed<LevelCountEntry[]>(() => {
        const summary = this.summary();
        if (!summary) {
            return [];
        }

        const total = summary.total || 0;
        if (total === 0) {
            return LEVELS.map(level => ({
                level,
                label: LEVEL_LABELS[level],
                count: 0,
                percentage: 0,
            }));
        }

        return LEVELS.map(level => {
            const count = summary.byLevel[level] ?? 0;
            const percentage = total === 0 ? 0 : (count / total) * 100;
            return {
                level,
                label: LEVEL_LABELS[level],
                count,
                percentage,
            };
        });
    });

    readonly hasData = computed(() => this.totalCount() > 0);

    readonly chartData = computed<ChartData<'doughnut'>>(() => {
        const entries = this.entries();
        return {
            labels: entries.map(entry => entry.label),
            datasets: [
                {
                    data: entries.map(entry => entry.count),
                    backgroundColor: [
                        '#5E35B1',
                        '#1E88E5',
                        '#43A047',
                        '#FB8C00',
                        '#E53935',
                        '#8E24AA',
                        '#546E7A',
                    ],
                    borderColor: '#121212',
                    borderWidth: 1,
                },
            ],
        };
    });

    readonly chartOptions: ChartConfiguration<'doughnut'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    usePointStyle: true,
                },
            },
            tooltip: {
                callbacks: {
                    label: context => {
                        const label = context.label ?? '';
                        const value = context.parsed;
                        const total = this.totalCount();
                        const percentage = total === 0 ? 0 : (Number(value) / total) * 100;
                        return `${label}: ${value} (${percentage.toFixed(1)}%)`;
                    },
                },
            },
        },
        animation: false,
    };
}
