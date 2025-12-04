import type { ParsingSpeed } from '../../shared/config/settings-config.types';
import type { NavItems } from './navigation';

export interface AppMetadataConfig {
  title: string;
  description: string;
  version: string;
  repositoryUrl?: string;
}

export interface ParsingSpeedPreset {
  chunkSize: number;
  delayMs: number;
}

export interface ParsingConfig {
  defaultSpeed: ParsingSpeed;
  presets: Record<ParsingSpeed, ParsingSpeedPreset>;
}

export interface NavigationSectionConfig {
  navItems: NavItems;
  defaultRoute: string;
}

export interface FeatureFlagsConfig {
  experimentalAnalysis: boolean;
  debugParsing: boolean;
}

export interface StorageConfig {
  userPreferencesKey: string;
}

export interface CoreAppConfig {
  metadata: AppMetadataConfig;
  parsing: ParsingConfig;
  storage: StorageConfig;
  navigation: NavigationSectionConfig;
  featureFlags: FeatureFlagsConfig;
}
