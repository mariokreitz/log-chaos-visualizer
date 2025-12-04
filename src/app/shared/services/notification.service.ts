import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

export type NotificationType = 'info' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class NotificationService {
    private readonly snackBar = inject(MatSnackBar);

    info(message: string): void {
        this.open(message, 'info');
    }

    success(message: string): void {
        this.open(message, 'success');
    }

    error(message: string): void {
        this.open(message, 'error');
    }

    private open(message: string, type: NotificationType): void {
        const config: MatSnackBarConfig = {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
            panelClass: [
                'app-snackbar',
                `app-snackbar-${type}`,
            ],
        };
        this.snackBar.open(message, 'Close', config);
    }
}
