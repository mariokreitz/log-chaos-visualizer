import type { ParsingSpeed } from '../../shared/config/settings-config.types';
import type { NavItems } from './navigation';

export type AppMetadataConfig = {
    title: string;
    description: string;
    version: string;
    repositoryUrl?: string;
};

export type ParsingSpeedPreset = {
    chunkSize: number;
    delayMs: number;
};

export type ParsingConfig = {
    defaultSpeed: ParsingSpeed;
    presets: Record<ParsingSpeed, ParsingSpeedPreset>;
};

export type NavigationSectionConfig = {
    navItems: NavItems;
    defaultRoute: string;
};

export type FeatureFlagsConfig = {
    experimentalAnalysis: boolean;
    debugParsing: boolean;
};

export type StorageConfig = {
    userPreferencesKey: string;
};

export type CoreAppConfig = {
    metadata: AppMetadataConfig;
    parsing: ParsingConfig;
    storage: StorageConfig;
    navigation: NavigationSectionConfig;
    featureFlags: FeatureFlagsConfig;
};
