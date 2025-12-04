import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
    selector: 'app-header',
    imports: [
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
    ],
    templateUrl: './header.html',
    styleUrl: './header.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        role: 'banner',
    },
})
export class Header {
    menuToggle = output<void>();

    readonly brand = signal('Log Chaos Visualizer');
    readonly brandUpper = computed(() => this.brand().toUpperCase());

    onToggleMenu(): void {
        this.menuToggle.emit();
    }
}
