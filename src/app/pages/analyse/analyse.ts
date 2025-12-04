import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FeatureFlagsService } from '../../core/services/feature-flags.service';
import { FileParseService } from '../../core/services/file-parse.service';
import { LogKindDoughnutChartComponent } from '../../shared/components/log-kind-doughnut-chart/log-kind-doughnut-chart';

@Component({
    selector: 'app-analyse',
    imports: [
        LogKindDoughnutChartComponent,
    ],
    templateUrl: './analyse.html',
    styleUrl: './analyse.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Analyse {
    private readonly featureFlags = inject(FeatureFlagsService);
    readonly experimentalAnalysisEnabled = this.featureFlags.experimentalAnalysis;
    private readonly fileParse = inject(FileParseService);
    readonly hasSummary = computed(() => {
        const summary = this.fileParse.summary();
        return summary !== null && summary.totalLines > 0;
    });

    readonly summary = computed(() => this.fileParse.summary());
}
