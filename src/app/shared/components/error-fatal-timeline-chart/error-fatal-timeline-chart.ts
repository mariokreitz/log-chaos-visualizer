import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartConfiguration, ChartData, ChartDataset, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import type { ErrorFatalTimelineSummary } from '../../../core/types/file-parse.types';

const FIVE_MIN_MS = 5 * 60 * 1000;

interface TimelineBucketView {
  start: number;
  end: number;
  error: number;
  fatal: number;
  total: number;
}

@Component({
  selector: 'app-error-fatal-timeline-chart',
  imports: [BaseChartDirective],
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

  readonly chartData = computed<ChartData<'bar', { x: Date; y: number }[]>>(() => {
    const summary = this.summary();

    if (!summary || summary.buckets.length === 0) {
      const now = Date.now();
      const base = now - FIVE_MIN_MS * 5; // show last 25 minutes as fallback
      const buckets: TimelineBucketView[] = Array.from({ length: 5 }, (_, i) => ({
        start: base + i * FIVE_MIN_MS,
        end: base + (i + 1) * FIVE_MIN_MS,
        error: 0,
        fatal: 0,
        total: 0,
      }));

      const errorPoints = buckets.map((bucket) => ({
        x: new Date(Math.floor((bucket.start + bucket.end) / 2)),
        y: bucket.error,
      }));

      const fatalPoints = buckets.map((bucket) => ({
        x: new Date(Math.floor((bucket.start + bucket.end) / 2)),
        y: bucket.fatal,
      }));

      const errorDataset: ChartDataset<'bar', { x: Date; y: number }[]> = {
        label: 'Error',
        data: errorPoints,
        backgroundColor: '#E53935',
        borderColor: '#B71C1C',
        borderWidth: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
        barThickness: 14,
      };

      const fatalDataset: ChartDataset<'bar', { x: Date; y: number }[]> = {
        label: 'Fatal',
        data: fatalPoints,
        backgroundColor: '#8E24AA',
        borderColor: '#6A1B9A',
        borderWidth: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
        barThickness: 14,
      };

      return {
        labels: [],
        datasets: [errorDataset, fatalDataset],
      };
    }

    const buckets: TimelineBucketView[] = this.reBucketToFiveMinutes(summary);

    const errorPoints = buckets.map((bucket) => ({
      x: new Date(Math.floor((bucket.start + bucket.end) / 2)),
      y: bucket.error,
    }));

    const fatalPoints = buckets.map((bucket) => ({
      x: new Date(Math.floor((bucket.start + bucket.end) / 2)),
      y: bucket.fatal,
    }));

    const errorDataset: ChartDataset<'bar', { x: Date; y: number }[]> = {
      label: 'Error',
      data: errorPoints,
      backgroundColor: '#E53935',
      borderColor: '#B71C1C',
      borderWidth: 1,
      barPercentage: 0.9,
      categoryPercentage: 0.9,
      barThickness: 14,
    };

    const fatalDataset: ChartDataset<'bar', { x: Date; y: number }[]> = {
      label: 'Fatal',
      data: fatalPoints,
      backgroundColor: '#8E24AA',
      borderColor: '#6A1B9A',
      borderWidth: 1,
      barPercentage: 0.9,
      categoryPercentage: 0.9,
      barThickness: 14,
    };

    return {
      labels: [],
      datasets: [errorDataset, fatalDataset],
    };
  });

  readonly chartOptions: ChartConfiguration<'bar'>['options'] = {
    datasets: {
      bar: {
        maxBarThickness: 20,
      },
    },
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
          title: (items: TooltipItem<'bar'>[]) => {
            if (!items.length) {
              return '';
            }

            const parsed = items[0].parsed as { x?: unknown };

            if (parsed.x instanceof Date) {
              return parsed.x.toLocaleString();
            }

            if (typeof parsed.x === 'number' && !Number.isNaN(parsed.x)) {
              return new Date(parsed.x).toLocaleString();
            }

            return items[0].label ?? '';
          },
          label: (item: TooltipItem<'bar'>) => {
            const label = item.dataset.label ?? '';
            const parsed = item.parsed as { y?: number };
            const value = typeof parsed.y === 'number' ? parsed.y : 0;
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: { minute: 'HH:mm' },
        },
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

  private reBucketToFiveMinutes(summary: ErrorFatalTimelineSummary): TimelineBucketView[] {
    if (summary.bucketSizeMs === FIVE_MIN_MS) {
      return summary.buckets
        .slice()
        .sort((a, b) => a.bucketStartMs - b.bucketStartMs)
        .map((bucket) => ({
          start: bucket.bucketStartMs,
          end: bucket.bucketEndMs,
          error: bucket.errorCount,
          fatal: bucket.fatalCount,
          total: bucket.total,
        }));
    }

    const starts = summary.buckets.map((bucket) => bucket.bucketStartMs);
    const ends = summary.buckets.map((bucket) => bucket.bucketEndMs);

    if (starts.length === 0 || ends.length === 0) {
      return [];
    }

    const minStart = Math.min(...starts);
    const maxEnd = Math.max(...ends);

    const base = Math.floor(minStart / FIVE_MIN_MS) * FIVE_MIN_MS;
    const last = Math.ceil(maxEnd / FIVE_MIN_MS) * FIVE_MIN_MS;
    const bucketCount = Math.max(0, Math.floor((last - base) / FIVE_MIN_MS));

    const buckets: TimelineBucketView[] = Array.from({ length: bucketCount }, (_, index) => ({
      start: base + index * FIVE_MIN_MS,
      end: base + (index + 1) * FIVE_MIN_MS,
      error: 0,
      fatal: 0,
      total: 0,
    }));

    for (const bucket of summary.buckets) {
      const targetIndex = Math.floor((bucket.bucketStartMs - base) / FIVE_MIN_MS);

      if (targetIndex >= 0 && targetIndex < buckets.length) {
        const target = buckets[targetIndex];
        target.error += bucket.errorCount;
        target.fatal += bucket.fatalCount;
        target.total += bucket.total;
      }
    }

    return buckets;
  }
}
