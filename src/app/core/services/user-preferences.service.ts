import { Injectable, signal } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';
import type { StoredSettings } from '../types/user-preferences.types';

const STORAGE_KEY = APP_CONFIG.storage.userPreferencesKey;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly raw = signal<StoredSettings | null>(null);

  constructor() {
    this.raw.set(this.safeLoad());
  }

  load(): StoredSettings | null {
    return this.raw();
  }

  update(partial: StoredSettings): void {
    const current = this.raw() ?? {};
    const next: StoredSettings = {
      ...current,
      ...partial,
      progressBarSettings: partial.progressBarSettings ?? current.progressBarSettings,
      featureFlags: {
        ...(current.featureFlags ?? {}),
        ...(partial.featureFlags ?? {}),
      },
    };
    this.raw.set(next);
    this.safeSave(next);
  }

  private safeLoad(): StoredSettings | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as StoredSettings;
    } catch {
      return null;
    }
  }

  private safeSave(value: StoredSettings): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  }
}
