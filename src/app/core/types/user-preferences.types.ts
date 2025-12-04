import type { ParsingSpeed, ProgressBarSettings } from '../../shared/config/settings-config.types';
import type { FeatureFlagsState } from './feature-flags.types';

export interface StoredSettings {
  parsingSpeed?: ParsingSpeed;
  progressBarSettings?: ProgressBarSettings;
  featureFlags?: Partial<FeatureFlagsState>;
}
