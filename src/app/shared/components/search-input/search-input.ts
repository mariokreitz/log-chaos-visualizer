import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-search-input',
  imports: [FormsModule, MatIconModule, MatProgressSpinnerModule],
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

  public onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.valueChange.emit(target.value);
  }

  public onClear(): void {
    this.clear.emit();
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  }
}
