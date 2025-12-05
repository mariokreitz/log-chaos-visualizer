import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FileParseService } from '../../core/services/file-parse.service';
import { NotificationService } from '../../core/services/notification.service';
import type { ParsedLogEntry } from '../../core/types/file-parse.types';
import { ErrorFatalTimelineChartComponent } from '../../shared/components/error-fatal-timeline-chart/error-fatal-timeline-chart';
import { FileSelectDialog } from '../../shared/components/file-select-dialog/file-select-dialog';
import { LogEnvironmentDoughnutChartComponent } from '../../shared/components/log-environment-doughnut-chart/log-environment-doughnut-chart';
import { LogKindDoughnutChartComponent } from '../../shared/components/log-kind-doughnut-chart/log-kind-doughnut-chart';
import { LogLevelDoughnutChartComponent } from '../../shared/components/log-level-doughnut-chart/log-level-doughnut-chart';
import { LogLevelTablesComponent } from '../../shared/components/log-level-tables/log-level-tables';
import { UI_CONFIG } from '../../shared/config/ui-config';

@Component({
  selector: 'app-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    LogKindDoughnutChartComponent,
    LogLevelDoughnutChartComponent,
    LogEnvironmentDoughnutChartComponent,
    ErrorFatalTimelineChartComponent,
    LogLevelTablesComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Dashboard {
  private readonly dialog = inject(MatDialog);
  private readonly fileParse = inject(FileParseService);
  readonly summary = computed(() => this.fileParse.summary());
  readonly levelSummary = computed(() => this.fileParse.summary()?.levelSummary ?? null);
  readonly environmentSummary = computed(() => this.fileParse.summary()?.environmentSummary ?? null);
  readonly errorFatalTimelineSummary = computed(() => this.fileParse.summary()?.errorFatalTimeline ?? null);
  readonly errorEntries = computed<ParsedLogEntry[]>(() => {
    const batch = this.fileParse.latestBatch();
    if (!batch) {
      return [];
    }
    const sorted = [...batch.entries].sort((a, b) => {
      const aTs = getTimestamp(a) ?? 0;
      const bTs = getTimestamp(b) ?? 0;
      return bTs - aTs;
    });
    return sorted.filter((entry) => getLevel(entry) === 'error').slice(0, 5);
  });
  readonly fatalEntries = computed<ParsedLogEntry[]>(() => {
    const batch = this.fileParse.latestBatch();
    if (!batch) {
      return [];
    }
    const sorted = [...batch.entries].sort((a, b) => {
      const aTs = getTimestamp(a) ?? 0;
      const bTs = getTimestamp(b) ?? 0;
      return bTs - aTs;
    });
    return sorted.filter((entry) => getLevel(entry) === 'fatal').slice(0, 5);
  });
  private readonly notifications = inject(NotificationService);

  openFileDialog(): void {
    const ref = this.dialog.open<FileSelectDialog, void, File | null>(FileSelectDialog, {
      width: UI_CONFIG.dialog.fileSelectWidth,
      autoFocus: true,
    });

    ref.afterClosed().subscribe((file) => {
      if (!file) {
        return;
      }
      this.notifications.info('Starting to parse selected log file…');
      this.fileParse.setFile(file);
      this.fileParse.startParse();
    });
  }
}

function getLevel(entry: ParsedLogEntry): 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown' {
  if (entry.kind === 'pino') {
    const level = entry.entry.level;
    if (level === 10) return 'trace';
    if (level === 20) return 'debug';
    if (level === 30) return 'info';
    if (level === 40) return 'warn';
    if (level === 50) return 'error';
    if (level === 60) return 'fatal';
    return 'unknown';
  }
  if (entry.kind === 'winston') {
    const level = entry.entry.level;
    if (level === 'debug') return 'debug';
    if (level === 'info') return 'info';
    if (level === 'warn') return 'warn';
    if (level === 'error') return 'error';
    return 'unknown';
  }
  if (entry.kind === 'promtail') {
    const level = entry.entry.level;
    if (level === 'debug') return 'debug';
    if (level === 'info') return 'info';
    if (level === 'warn') return 'warn';
    if (level === 'error') return 'error';
    return 'unknown';
  }
  return 'unknown';
}

function getTimestamp(entry: ParsedLogEntry): number | null {
  // mirror logic from LogLevelTablesComponent.getTimestamp
  if (entry.kind === 'pino') return entry.entry.time;
  if (entry.kind === 'winston') {
    const date = Date.parse(entry.entry.timestamp);
    return Number.isNaN(date) ? null : date;
  }
  if (entry.kind === 'loki' || entry.kind === 'promtail') {
    const date = Date.parse(entry.entry.ts);
    return Number.isNaN(date) ? null : date;
  }
  if (entry.kind === 'docker') {
    const date = Date.parse(entry.entry.time);
    return Number.isNaN(date) ? null : date;
  }
  return null;
}
