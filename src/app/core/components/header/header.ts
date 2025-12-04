import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

@Component({
    selector: 'app-header',
    imports: [],
    templateUrl: './header.html',
    styleUrl: './header.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
    protected readonly mobileNavOpen = signal(false);

    protected readonly toggleSidebar = output<boolean>();

    protected toggle(): void {
        const next = !this.mobileNavOpen();
        this.mobileNavOpen.set(next);
        this.toggleSidebar.emit(next);
    }
}
