import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { APP_CONFIG } from '../config/app-config';

export type FeatureFlagsState = {
    experimentalAnalysis: boolean;
    debugParsing: boolean;
};

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
    readonly isProduction = environment.production;
    private readonly initial: FeatureFlagsState = {
        experimentalAnalysis: APP_CONFIG.featureFlags.experimentalAnalysis,
        debugParsing: APP_CONFIG.featureFlags.debugParsing,
    };
    readonly experimentalAnalysis = signal<boolean>(this.initial.experimentalAnalysis);
    readonly debugParsing = signal<boolean>(this.initial.debugParsing);

    setExperimentalAnalysis(enabled: boolean): void {
        this.experimentalAnalysis.set(enabled);
    }

    setDebugParsing(enabled: boolean): void {
        this.debugParsing.set(enabled);
    }
}

