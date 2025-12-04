import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { UI_CONFIG } from '../../shared/config/ui-config';
import type { NotificationType } from '../types/notification.types';

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
    const snackbarConfig = UI_CONFIG.snackbar;
    const config: MatSnackBarConfig = {
      duration: snackbarConfig.durationMs,
      horizontalPosition: snackbarConfig.horizontalPosition,
      verticalPosition: snackbarConfig.verticalPosition,
      panelClass: ['app-snackbar', `app-snackbar-${type}`],
    };
    this.snackBar.open(message, 'Close', config);
  }
}
