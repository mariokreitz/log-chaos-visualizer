import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { EnvironmentSummary, NormalizedEnvironment } from '../../../core/types/file-parse.types';

export interface EnvironmentCountEntry {
  environment: NormalizedEnvironment;
  label: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-log-environment-doughnut-chart',
  imports: [BaseChartDirective],
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
    const total = summary?.total ?? 0;

    const environments: NormalizedEnvironment[] = ['dev', 'staging', 'prod', 'unknown'];

    if (!summary || total === 0) {
      return [
        {
          environment: 'unknown',
          label: 'No data',
          count: 0,
          percentage: 0,
        },
      ];
    }

    return environments.map((env) => {
      const count = summary.byEnvironment[env] ?? 0;
      const percentage = total === 0 ? 0 : (count / total) * 100;
      const label = env === 'unknown' ? 'Unknown' : env.toUpperCase();
      return { environment: env, label, count, percentage };
    });
  });

  readonly chartData = computed<ChartData<'doughnut'>>(() => {
    const entries = this.entries();

    const baseColors = ['#546E7A', '#43A047', '#1E88E5', '#FB8C00'];
    const colors = entries.map((_, index) => baseColors[index % baseColors.length]);

    const rawCounts = entries.map((entry) => entry.count);
    const hasAnyNonZero = rawCounts.some((value) => value > 0);
    const displayData = hasAnyNonZero ? rawCounts : rawCounts.map(() => 1);

    return {
      labels: entries.map((entry) => entry.label),
      datasets: [
        {
          data: displayData,
          backgroundColor: colors,
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
          label: (context) => {
            const label = context.label ?? '';
            const index = context.dataIndex ?? 0;
            const entries = this.entries();
            const entry = entries[index];
            const trueValue = entry?.count ?? 0;
            const total = this.totalCount();
            const percentage = total === 0 ? 0 : (trueValue / total) * 100;
            return `${label}: ${trueValue} (${percentage.toFixed(1)}%)`;
          },
        },
      },
    },
    animation: false,
    cutout: '60%',
  };
}
