import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { QueryHelpDialog } from '../../shared/components/query-help-dialog/query-help-dialog';

@Component({
  selector: 'app-help-me',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './help-me.html',
  styleUrl: './help-me.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HelpMe {
  private readonly dialog = inject(MatDialog);

  openQueryHelp(): void {
    this.dialog.open(QueryHelpDialog, {
      width: '90vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'query-help-dialog-container',
    });
  }
}
