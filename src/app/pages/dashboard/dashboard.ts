import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FileParseService } from '../../core/services/file-parse.service';
import { NotificationService } from '../../core/services/notification.service';
import { ErrorFatalTimelineChartComponent } from '../../shared/components/error-fatal-timeline-chart/error-fatal-timeline-chart';
import { FileSelectDialog } from '../../shared/components/file-select-dialog/file-select-dialog';
import {
    LogEnvironmentDoughnutChartComponent,
} from '../../shared/components/log-environment-doughnut-chart/log-environment-doughnut-chart';
import { LogKindDoughnutChartComponent } from '../../shared/components/log-kind-doughnut-chart/log-kind-doughnut-chart';
import { LogLevelDoughnutChartComponent } from '../../shared/components/log-level-doughnut-chart/log-level-doughnut-chart';
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
    ],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Dashboard {
    private readonly dialog = inject(MatDialog);
    private readonly fileParse = inject(FileParseService);
    readonly hasSummary = computed(() => {
        const summary = this.fileParse.summary();
        return summary !== null && summary.totalLines > 0;
    });
    readonly summary = computed(() => this.fileParse.summary());
    readonly levelSummary = computed(() => this.fileParse.summary()?.levelSummary ?? null);
    readonly environmentSummary = computed(() => this.fileParse.summary()?.environmentSummary ?? null);
    readonly errorFatalTimelineSummary = computed(() => this.fileParse.summary()?.errorFatalTimeline ?? null);
    private readonly notifications = inject(NotificationService);

    openFileDialog(): void {
        const ref = this.dialog.open<FileSelectDialog, void, File | null>(FileSelectDialog, {
            width: UI_CONFIG.dialog.fileSelectWidth,
            autoFocus: true,
        });

        ref.afterClosed().subscribe(file => {
            if (!file) {
                return;
            }
            this.notifications.info('Starting to parse selected log file…');
            this.fileParse.setFile(file);
            this.fileParse.startParse();
        });
    }
}
