import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'app-query-help-dialog',
  imports: [MatDialogModule, MatTabsModule, MatButtonModule, MatIconModule],
  templateUrl: './query-help-dialog.html',
  styleUrl: './query-help-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryHelpDialog {
  private readonly dialogRef = inject(MatDialogRef<QueryHelpDialog>);

  close(): void {
    this.dialogRef.close();
  }
}
