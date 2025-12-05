import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-warning-banner',
  imports: [MatIconModule],
  templateUrl: './warning-banner.html',
  styleUrls: ['./warning-banner.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'warning-banner-host',
    '[attr.aria-live]': 'ariaLive()',
    '[attr.role]': 'role()',
  },
})
export class WarningBanner {
  /**
   * The warning message to display
   */
  public readonly message = input<string>('');

  /**
   * The title/header of the warning
   */
  public readonly title = input<string>('Warning');

  /**
   * The severity level of the warning
   */
  public readonly severity = input<'info' | 'warning' | 'danger'>('warning');

  /**
   * Whether the warning can be dismissed
   */
  public readonly dismissible = input<boolean>(false);

  /**
   * ARIA live region setting for screen readers
   */
  public readonly ariaLive = input<'off' | 'polite' | 'assertive'>('polite');

  /**
   * ARIA role for the banner
   */
  public readonly role = input<'banner' | 'alert' | 'status'>('banner');

  /**
   * Emitted when the dismiss button is clicked
   */
  public readonly dismissed = output<void>();

  /**
   * Handle dismiss button click
   */
  public onDismiss(): void {
    this.dismissed.emit();
  }

  /**
   * Get the icon name based on severity
   */
  public getIconName(): string {
    switch (this.severity()) {
      case 'danger':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  }

  /**
   * Get the CSS class for the severity
   */
  public getSeverityClass(): string {
    return `warning-banner--${this.severity()}`;
  }
}
