import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FileSelector } from '../../../core/components/file-selector/file-selector';

@Component({
  selector: 'app-file-select-dialog',
  imports: [MatDialogModule, MatButtonModule, FileSelector],
  templateUrl: './file-select-dialog.html',
  styleUrl: './file-select-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileSelectDialog {
  private readonly dialogRef = inject<MatDialogRef<FileSelectDialog, File | null>>(MatDialogRef);

  onFileSelected(file: File): void {
    this.close(file);
  }

  close(result: File | null): void {
    this.dialogRef.close(result);
  }
}
