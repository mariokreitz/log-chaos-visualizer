import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
    private readonly parse = inject(FileParseService);

    readonly isParsing = this.parse.isParsing;
}

