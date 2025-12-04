import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FileSelector } from '../../core/components/file-selector/file-selector';
import { FileParseService } from '../../core/services/file-parse.service';

@Component({
    selector: 'app-analyse',
    imports: [ FileSelector ],
    templateUrl: './analyse.html',
    styleUrl: './analyse.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Analyse {
    private readonly parse = inject(FileParseService);

    readonly progress = this.parse.progress;
    readonly summary = this.parse.summary;
    readonly error = this.parse.error;
    readonly isParsing = this.parse.isParsing;
    readonly latestBatch = this.parse.latestBatch;

    readonly hasFile = computed(() => this.parse.selectedFile() !== null);

    onFileSelected(file: File): void {
        this.parse.setFile(file);
    }

    startParse(): void {
        this.parse.startParse();
    }
}
