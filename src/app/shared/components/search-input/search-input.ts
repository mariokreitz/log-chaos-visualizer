import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchService } from '../../../core/services/search.service';
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
  public readonly isSearching = input<boolean>(false);
  public readonly placeholder = input<string>('Search logs...');
  public readonly ariaLabel = input<string>('Search logs');
  public readonly openHelp = output<void>();
  protected readonly validationErrors = signal<string[]>([]);
  protected readonly isValid = computed(() => this.validationErrors().length === 0);
  private readonly searchService = inject(SearchService);
  protected readonly hasValue = computed(() => this.searchService.query().trim().length > 0);
  protected readonly query = computed(() => this.searchService.query());

  // Debounced input value
  private debounceTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

  public onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const query = target.value;
    const validation = validateQuery(query);
    if (!validation.valid) {
      this.validationErrors.set(validation.errors.map((e) => e.message));
    } else {
      this.validationErrors.set([]);
    }
    // Only update local input, do not execute query until Enter
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      // Optionally update a local signal if needed
    }, 300);
  }

  public onClear(): void {
    this.validationErrors.set([]);
    this.searchService.setQuery('');
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.isValid()) {
        this.searchService.setQuery((event.target as HTMLInputElement).value);
      }
    }
  }

  public onHelpClick(): void {
    this.openHelp.emit();
  }
}
