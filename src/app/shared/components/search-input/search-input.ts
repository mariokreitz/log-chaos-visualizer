import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { validateQuery } from '../../../core/utils/query-parser';

@Component({
  selector: 'app-search-input',
  imports: [FormsModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './search-input.html',
  styleUrls: ['./search-input.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'search-input-host',
  },
})
export class SearchInput {
  public readonly value = input<string>('');
  public readonly isSearching = input<boolean>(false);
  public readonly placeholder = input<string>('Search logs...');
  public readonly ariaLabel = input<string>('Search logs');
  public readonly valueChange = output<string>();
  public readonly clear = output<void>();
  public readonly openHelp = output<void>();
  public readonly searchSubmit = output<void>();

  protected readonly validationErrors = signal<string[]>([]);
  protected readonly isValid = computed(() => this.validationErrors().length === 0);
  protected readonly hasValue = computed(() => this.value().trim().length > 0);

  public onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const query = target.value;

    const validation = validateQuery(query);
    if (!validation.valid) {
      this.validationErrors.set(validation.errors.map((e) => e.message));
    } else {
      this.validationErrors.set([]);
    }

    this.valueChange.emit(query);
  }

  public onClear(): void {
    this.validationErrors.set([]);
    this.clear.emit();
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      // Only submit if query is valid
      if (this.isValid()) {
        this.searchSubmit.emit();
      }
    }
  }

  public onHelpClick(): void {
    this.openHelp.emit();
  }
}
