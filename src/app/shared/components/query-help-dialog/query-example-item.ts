import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-query-example-item',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="example-item">
      <div class="main">
        <code class="code-inline" title="{{ query() }}">{{ query() }}</code>
        <p class="description">{{ description() }}</p>
      </div>

      <div class="actions">
        <button mat-icon-button aria-label="Copy example" (click)="handleCopy()">
          <mat-icon>content_copy</mat-icon>
        </button>
        <button mat-stroked-button color="primary" (click)="handleInsert()">Insert</button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .example-item {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: space-between;
      }
      .example-item .main {
        flex: 1 1 auto;
        min-width: 0;
      }
      .code-inline {
        display: block;
        font-family:
          var(--font-mono-stack), ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;
        font-size: 0.9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .description {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 0.78rem;
      }
      .actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryExampleItem {
  // inputs using signal-style helpers
  readonly query = input<string>('');
  readonly description = input<string>('');

  // outputs: use the output helper which provides an emitter with .emit()
  readonly onCopy = output<void>();
  readonly onInsert = output<void>();

  handleCopy(): void {
    this.onCopy.emit();
  }

  handleInsert(): void {
    this.onInsert.emit();
  }
}
