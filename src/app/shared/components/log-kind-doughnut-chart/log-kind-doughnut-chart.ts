import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { ExtendedParseSummary, ParsedKind } from '../../../core/types/file-parse.types';

const PARSED_KINDS: ParsedKind[] = ['pino', 'winston', 'loki', 'promtail', 'docker', 'unknown-json', 'text'];

const PARSED_KIND_LABELS: Record<ParsedKind, string> = {
  pino: 'Pino',
  winston: 'Winston',
  loki: 'Loki',
  promtail: 'Promtail',
  docker: 'Docker',
  'unknown-json': 'Unknown JSON',
  text: 'Plain text',
};

export interface ParsedKindCountEntry {
  kind: ParsedKind;
  label: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-log-kind-doughnut-chart',
  imports: [BaseChartDirective],

  templateUrl: './log-kind-doughnut-chart.html',
  styleUrl: './log-kind-doughnut-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'log-kind-doughnut-chart',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class LogKindDoughnutChartComponent {
  readonly summary = input<ExtendedParseSummary | null>(null);
  readonly title = input<string>('Log entries by kind');
  readonly ariaLabel = input<string>('Distribution of parsed log entries by kind');

  readonly totalCount = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return 0;
    }
    return summary.totalLines;
  });

  readonly malformedCount = computed(() => this.summary()?.malformedCount ?? 0);

  readonly entries = computed<ParsedKindCountEntry[]>(() => {
    const summary = this.summary();
    const total = summary?.totalLines ?? 0;

    if (!summary || total === 0) {
      return [
        {
          kind: 'unknown-json',
          label: 'No data',
          count: 0,
          percentage: 0,
        },
      ];
    }

    return PARSED_KINDS.map((kind) => {
      const count = summary.counts[kind] ?? 0;
      const percentage = total === 0 ? 0 : (count / total) * 100;
      return {
        kind,
        label: PARSED_KIND_LABELS[kind],
        count,
        percentage,
      };
    });
  });

  readonly chartData = computed<ChartData<'doughnut'>>(() => {
    const entries = this.entries();

    const baseColors = ['#546E7A', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B', '#F4511E'];
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
