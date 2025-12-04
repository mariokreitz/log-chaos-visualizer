import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

@Component({
  selector: 'app-file-selector',
  imports: [],
  templateUrl: './file-selector.html',
  styleUrl: './file-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-file-selector',
  },
})
export class FileSelector {
  private static readonly allowed = new Set(['.txt', '.log', '.json']);

  readonly fileSelected = output<File>();

  // local state
  readonly fileName = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly dragActive = signal<boolean>(false);

  private static getExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
  }

  onFileChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    const file = inputEl?.files?.[0] ?? null;
    this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.handleFile(file);
  }

  private handleFile(file: File | null): void {
    if (!file) {
      this.fileName.set(null);
      this.error.set(null);
      return;
    }

    const name = file.name;
    const ext = FileSelector.getExtension(name);

    if (!FileSelector.allowed.has(ext)) {
      this.fileName.set(null);
      this.error.set(`Unsupported file type: ${ext}. Choose .txt, .log or .json.`);
      return;
    }

    this.error.set(null);
    this.fileName.set(name);
    this.fileSelected.emit(file);
  }
}
