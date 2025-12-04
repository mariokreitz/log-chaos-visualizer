import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FileParseService } from '../../core/services/file-parse.service';
import { FileSelectDialog } from '../../shared/components/file-select-dialog/file-select-dialog';
import { UI_CONFIG } from '../../shared/config/ui-config';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
    selector: 'app-dashboard',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
    ],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Dashboard {
    private readonly dialog = inject(MatDialog);
    private readonly fileParse = inject(FileParseService);
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
