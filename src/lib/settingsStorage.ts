/**
 * SettingsStorage - LocalStorage Operations for App Settings
 *
 * Provides type-safe operations for app settings using the StorageService.
 * Handles schema migrations when settings structure changes.
 *
 * Features:
 * - getSettings() - Get current settings (with defaults)
 * - saveSettings(settings) - Save settings to storage
 * - updateSettings(partial) - Update specific settings
 * - resetSettings() - Reset to default settings
 * - Schema migrations for backwards compatibility
 */

import { storage, STORAGE_KEYS } from './storage';
import type { AppSettings, Theme, FontSize } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

// ============================================
// Schema Version
// ============================================

/**
 * Current settings schema version
 * Increment this when the settings structure changes
 */
const SETTINGS_SCHEMA_VERSION = 1;

/**
 * Serialized settings format for storage
 * Includes schema version for migrations
 */
interface SerializedSettings {
  version: number;
  settings: AppSettings;
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if a value is a valid Theme
 */
function isValidTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Check if a value is a valid FontSize
 */
function isValidFontSize(value: unknown): value is FontSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

/**
 * Validate and sanitize settings
 * Ensures all required fields exist with valid values
 */
function sanitizeSettings(data: Partial<AppSettings>): AppSettings {
  return {
    theme: isValidTheme(data.theme) ? data.theme : DEFAULT_SETTINGS.theme,
    fontSize: isValidFontSize(data.fontSize) ? data.fontSize : DEFAULT_SETTINGS.fontSize,
    sendOnEnter:
      typeof data.sendOnEnter === 'boolean' ? data.sendOnEnter : DEFAULT_SETTINGS.sendOnEnter,
    showTimestamps:
      typeof data.showTimestamps === 'boolean'
        ? data.showTimestamps
        : DEFAULT_SETTINGS.showTimestamps,
    defaultModel:
      typeof data.defaultModel === 'string' && data.defaultModel.length > 0
        ? data.defaultModel
        : DEFAULT_SETTINGS.defaultModel,
    embeddingModel:
      typeof data.embeddingModel === 'string' && data.embeddingModel.length > 0
        ? data.embeddingModel
        : DEFAULT_SETTINGS.embeddingModel,
    enableStreaming:
      typeof data.enableStreaming === 'boolean'
        ? data.enableStreaming
        : DEFAULT_SETTINGS.enableStreaming,
    showMarkdownPreview:
      typeof data.showMarkdownPreview === 'boolean'
        ? data.showMarkdownPreview
        : DEFAULT_SETTINGS.showMarkdownPreview,
    sidebarCollapsed:
      typeof data.sidebarCollapsed === 'boolean'
        ? data.sidebarCollapsed
        : DEFAULT_SETTINGS.sidebarCollapsed,
    autoSave:
      typeof data.autoSave === 'boolean'
        ? data.autoSave
        : DEFAULT_SETTINGS.autoSave,
    systemPrompt:
      typeof data.systemPrompt === 'string'
        ? data.systemPrompt
        : (DEFAULT_SETTINGS.systemPrompt ?? ''),
  };
}

// ============================================
// Migration Functions
// ============================================

/**
 * Migration definitions
 * Each migration transforms settings from version N to N+1
 */
type MigrationFn = (settings: Partial<AppSettings>) => Partial<AppSettings>;

const migrations: Record<number, MigrationFn> = {
  // Example migration from version 0 to 1:
  // 0: (settings) => {
  //   // Add new field with default value
  //   return { ...settings, newField: 'defaultValue' };
  // },
};

/**
 * Apply all necessary migrations to bring settings up to current version
 */
function migrateSettings(
  data: Partial<AppSettings>,
  fromVersion: number
): { settings: AppSettings; migrated: boolean } {
  let currentSettings = { ...data };
  let migrated = false;

  // Apply migrations in order
  for (let version = fromVersion; version < SETTINGS_SCHEMA_VERSION; version++) {
    const migration = migrations[version];
    if (migration) {
      currentSettings = migration(currentSettings);
      migrated = true;
      console.log(`SettingsStorage: Migrated settings from v${version} to v${version + 1}`);
    }
  }

  return {
    settings: sanitizeSettings(currentSettings),
    migrated,
  };
}

// ============================================
// SettingsStorage Class
// ============================================

class SettingsStorage {
  /**
   * Get the current settings
   * Returns default settings if none are stored
   * Applies migrations if stored settings are from an older version
   *
   * @returns Current app settings
   */
  getSettings(): AppSettings {
    const data = storage.get<SerializedSettings | AppSettings>(STORAGE_KEYS.SETTINGS);

    if (!data) {
      // No settings stored, return defaults
      return { ...DEFAULT_SETTINGS };
    }

    // Check if this is the new format (with version)
    if (typeof data === 'object' && 'version' in data && 'settings' in data) {
      const serialized = data as SerializedSettings;

      // Check if migration is needed
      if (serialized.version < SETTINGS_SCHEMA_VERSION) {
        const { settings, migrated } = migrateSettings(
          serialized.settings,
          serialized.version
        );

        // Save migrated settings
        if (migrated) {
          this.saveSettings(settings);
        }

        return settings;
      }

      // Current version, just sanitize and return
      return sanitizeSettings(serialized.settings);
    }

    // Old format (no version) - treat as version 0
    const { settings } = migrateSettings(data as Partial<AppSettings>, 0);

    // Always save to upgrade to new format with version number
    this.saveSettings(settings);

    return settings;
  }

  /**
   * Save settings to storage
   *
   * @param settings - The settings to save
   * @returns true if saved successfully
   */
  saveSettings(settings: AppSettings): boolean {
    try {
      const serialized: SerializedSettings = {
        version: SETTINGS_SCHEMA_VERSION,
        settings: sanitizeSettings(settings),
      };

      return storage.set(STORAGE_KEYS.SETTINGS, serialized);
    } catch (error) {
      console.error('SettingsStorage: Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Update specific settings (partial update)
   *
   * @param updates - Partial settings to update
   * @returns The updated settings or null if failed
   */
  updateSettings(updates: Partial<AppSettings>): AppSettings | null {
    try {
      const currentSettings = this.getSettings();
      const newSettings: AppSettings = {
        ...currentSettings,
        ...updates,
      };

      const saved = this.saveSettings(newSettings);

      if (saved) {
        return newSettings;
      }

      return null;
    } catch (error) {
      console.error('SettingsStorage: Failed to update settings:', error);
      return null;
    }
  }

  /**
   * Reset all settings to defaults
   *
   * @returns true if reset successfully
   */
  resetSettings(): boolean {
    return this.saveSettings({ ...DEFAULT_SETTINGS });
  }

  /**
   * Get a specific setting value
   *
   * @param key - The setting key
   * @returns The setting value
   */
  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    const settings = this.getSettings();
    return settings[key];
  }

  /**
   * Set a specific setting value
   *
   * @param key - The setting key
   * @param value - The new value
   * @returns true if saved successfully
   */
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): boolean {
    const settings = this.getSettings();
    settings[key] = value;
    return this.saveSettings(settings);
  }

  /**
   * Check if settings exist in storage
   *
   * @returns true if settings have been saved
   */
  hasSettings(): boolean {
    return storage.has(STORAGE_KEYS.SETTINGS);
  }

  /**
   * Get the current schema version
   *
   * @returns The schema version number
   */
  getSchemaVersion(): number {
    return SETTINGS_SCHEMA_VERSION;
  }

  /**
   * Get the stored schema version
   *
   * @returns The stored version or 0 if not found
   */
  getStoredVersion(): number {
    const data = storage.get<SerializedSettings>(STORAGE_KEYS.SETTINGS);

    if (data && typeof data === 'object' && 'version' in data) {
      return (data as SerializedSettings).version;
    }

    return 0;
  }

  /**
   * Subscribe to settings changes (cross-tab sync)
   *
   * @param listener - Callback when settings change
   * @returns Unsubscribe function
   */
  subscribe(listener: (settings: AppSettings | null) => void): () => void {
    return storage.subscribe<SerializedSettings>(STORAGE_KEYS.SETTINGS, (newValue) => {
      if (newValue && 'settings' in newValue) {
        listener(sanitizeSettings(newValue.settings));
      } else if (newValue) {
        // Old format
        listener(sanitizeSettings(newValue as unknown as Partial<AppSettings>));
      } else {
        listener(null);
      }
    });
  }
}

// ============================================
// Singleton Instance
// ============================================

/**
 * Default SettingsStorage instance
 * Use this for all settings storage operations
 */
export const settingsStorage = new SettingsStorage();

// Also export the class for testing
export { SettingsStorage };

// Export types for external use
export type { SerializedSettings };
