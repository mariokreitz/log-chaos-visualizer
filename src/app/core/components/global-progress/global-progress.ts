import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FileParseService } from '../../services/file-parse.service';

@Component({
    selector: 'app-global-progress',
    imports: [ MatProgressBarModule ],
    templateUrl: './global-progress.html',
    styleUrl: './global-progress.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalProgress {
    readonly value = computed(() => {
        const p = this.progress();
        return p ? p.percent : 0;
    });
    readonly bufferValue = computed(() => {
        const p = this.progress();
        return p ? p.percent : 0;
    });
    private readonly parse = inject(FileParseService);
    readonly isParsing = this.parse.isParsing;
    readonly progress = this.parse.progress;
}
