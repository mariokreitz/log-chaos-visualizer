import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Header } from '../components/header/header';

@Component({
    selector: 'app-layout',
    imports: [
        Header,
    ],
    templateUrl: './layout.html',
    styleUrl: './layout.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {
    protected readonly sidebarOpen = signal(false);

    /** Toggle when no arg passed; set explicit state when boolean provided */
    protected setSidebar(open?: boolean): void {
        if (typeof open === 'boolean') {
            this.sidebarOpen.set(open);
        } else {
            this.sidebarOpen.update((v) => !v);
        }
    }

    protected isSidebarOpen(): boolean {
        return this.sidebarOpen();
    }
}
