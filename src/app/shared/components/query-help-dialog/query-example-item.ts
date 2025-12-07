import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-query-example-item',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="example-item" role="listitem" tabindex="0">
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
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: var(--radius-sm, 8px);
        border: 1px solid var(--color-border-subtle);
        background: var(--color-surface, transparent);
        margin-bottom: var(--space-4);
        transition:
          transform 120ms ease,
          box-shadow 120ms ease,
          background 120ms ease;
      }
      .example-item:focus {
        outline: none;
      }
      .example-item .main {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
      }
      .code-inline {
        display: block;
        font-family:
          var(--font-mono-stack), ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;
        font-size: 0.92rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--color-accent);
      }
      .description {
        margin: 4px 0 0 0;
        color: var(--color-text-muted);
        font-size: 0.78rem;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
      }
      button[mat-stroked-button] {
        height: 32px;
        padding: 0 10px;
        min-width: 64px;
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
  readonly copyRequested = output<void>();
  readonly insertRequested = output<void>();

  handleCopy(): void {
    this.copyRequested.emit();
  }

  handleInsert(): void {
    this.insertRequested.emit();
  }
}
