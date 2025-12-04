import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { EnvironmentSummary, NormalizedEnvironment } from '../../../core/types/file-parse.types';

export type EnvironmentCountEntry = {
    environment: NormalizedEnvironment;
    label: string;
    count: number;
    percentage: number;
};

@Component({
    selector: 'app-log-environment-doughnut-chart',
    imports: [
        BaseChartDirective,
        DecimalPipe,
    ],
    templateUrl: './log-environment-doughnut-chart.html',
    styleUrl: './log-environment-doughnut-chart.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'log-environment-doughnut-chart',
        role: 'group',
        '[attr.aria-label]': 'ariaLabel()',
    },
})
export class LogEnvironmentDoughnutChartComponent {
    readonly summary = input<EnvironmentSummary | null>(null);
    readonly title = input<string>('Log entries by environment');
    readonly ariaLabel = input<string>('Distribution of parsed log entries by environment');

    readonly totalCount = computed(() => {
        const summary = this.summary();
        return summary?.total ?? 0;
    });

    readonly entries = computed<EnvironmentCountEntry[]>(() => {
        const summary = this.summary();
        if (!summary) {
            return [];
        }

        const total = summary.total || 0;
        const entries: EnvironmentCountEntry[] = [];

        const environments: NormalizedEnvironment[] = [
            'dev',
            'staging',
            'prod',
            'unknown',
        ];
        for (const env of environments) {
            const count = summary.byEnvironment[env] ?? 0;
            const percentage = total === 0 ? 0 : (count / total) * 100;
            const label = env === 'unknown' ? 'Unknown' : env.toUpperCase();
            entries.push({ environment: env, label, count, percentage });
        }

        return entries;
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
                        '#43A047',
                        '#1E88E5',
                        '#FB8C00',
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

