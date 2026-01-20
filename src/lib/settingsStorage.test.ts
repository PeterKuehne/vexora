/**
 * Unit Tests for SettingsStorage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsStorage } from './settingsStorage';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { AppSettings } from '../types/settings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('SettingsStorage', () => {
  let settingsStorage: SettingsStorage;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    settingsStorage = new SettingsStorage();
  });

  describe('getSettings', () => {
    it('should return default settings when nothing is stored', () => {
      const settings = settingsStorage.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return stored settings', () => {
      const customSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        theme: 'light',
        fontSize: 'large',
        sendOnEnter: false,
      };

      localStorageMock.setItem(
        'vexora-settings',
        JSON.stringify({
          value: {
            version: 1,
            settings: customSettings,
          },
        })
      );

      const settings = settingsStorage.getSettings();
      expect(settings.theme).toBe('light');
      expect(settings.fontSize).toBe('large');
      expect(settings.sendOnEnter).toBe(false);
    });

    it('should sanitize invalid values to defaults', () => {
      localStorageMock.setItem(
        'vexora-settings',
        JSON.stringify({
          value: {
            version: 1,
            settings: {
              theme: 'invalid-theme',
              fontSize: 'invalid-size',
              sendOnEnter: 'not-a-boolean',
            },
          },
        })
      );

      const settings = settingsStorage.getSettings();
      expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
      expect(settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
      expect(settings.sendOnEnter).toBe(DEFAULT_SETTINGS.sendOnEnter);
    });

    it('should handle old format without version', () => {
      localStorageMock.setItem(
        'vexora-settings',
        JSON.stringify({
          value: {
            theme: 'light',
            fontSize: 'small',
          },
        })
      );

      const settings = settingsStorage.getSettings();
      expect(settings.theme).toBe('light');
      expect(settings.fontSize).toBe('small');
      // Should have defaults for missing values
      expect(settings.sendOnEnter).toBe(DEFAULT_SETTINGS.sendOnEnter);
    });
  });

  describe('saveSettings', () => {
    it('should save settings to storage', () => {
      const customSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        theme: 'light',
        defaultModel: 'llama3.2:latest',
      };

      const result = settingsStorage.saveSettings(customSettings);
      expect(result).toBe(true);

      // Verify it was saved
      const saved = settingsStorage.getSettings();
      expect(saved.theme).toBe('light');
      expect(saved.defaultModel).toBe('llama3.2:latest');
    });

    it('should include schema version when saving', () => {
      settingsStorage.saveSettings(DEFAULT_SETTINGS);

      const stored = localStorageMock.getItem('vexora-settings');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.value.version).toBe(1);
    });
  });

  describe('updateSettings', () => {
    it('should update specific settings', () => {
      settingsStorage.saveSettings(DEFAULT_SETTINGS);

      const updated = settingsStorage.updateSettings({
        theme: 'light',
        showTimestamps: false,
      });

      expect(updated).not.toBeNull();
      expect(updated!.theme).toBe('light');
      expect(updated!.showTimestamps).toBe(false);
      // Other settings should remain
      expect(updated!.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    });

    it('should preserve other settings when updating', () => {
      // Save initial settings with custom values
      settingsStorage.saveSettings({
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        fontSize: 'large',
        sendOnEnter: false,
      });

      // Update only theme
      const result = settingsStorage.updateSettings({ theme: 'light' });

      expect(result).not.toBeNull();
      expect(result!.theme).toBe('light');
      // Other custom values should be preserved
      expect(result!.fontSize).toBe('large');
      expect(result!.sendOnEnter).toBe(false);
    });
  });

  describe('resetSettings', () => {
    it('should reset to default settings', () => {
      // First save custom settings
      settingsStorage.saveSettings({
        ...DEFAULT_SETTINGS,
        theme: 'light',
        fontSize: 'large',
      });

      // Then reset
      const result = settingsStorage.resetSettings();
      expect(result).toBe(true);

      // Verify defaults are back
      const settings = settingsStorage.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('getSetting', () => {
    it('should get a specific setting', () => {
      settingsStorage.saveSettings({
        ...DEFAULT_SETTINGS,
        theme: 'light',
      });

      const theme = settingsStorage.getSetting('theme');
      expect(theme).toBe('light');
    });
  });

  describe('setSetting', () => {
    it('should set a specific setting', () => {
      settingsStorage.saveSettings(DEFAULT_SETTINGS);

      const result = settingsStorage.setSetting('fontSize', 'large');
      expect(result).toBe(true);

      const settings = settingsStorage.getSettings();
      expect(settings.fontSize).toBe('large');
    });
  });

  describe('hasSettings', () => {
    it('should return false when no settings stored', () => {
      expect(settingsStorage.hasSettings()).toBe(false);
    });

    it('should return true when settings are stored', () => {
      settingsStorage.saveSettings(DEFAULT_SETTINGS);
      expect(settingsStorage.hasSettings()).toBe(true);
    });
  });

  describe('getSchemaVersion', () => {
    it('should return the current schema version', () => {
      expect(settingsStorage.getSchemaVersion()).toBe(1);
    });
  });

  describe('getStoredVersion', () => {
    it('should return 0 when no settings stored', () => {
      expect(settingsStorage.getStoredVersion()).toBe(0);
    });

    it('should return the stored version', () => {
      settingsStorage.saveSettings(DEFAULT_SETTINGS);
      expect(settingsStorage.getStoredVersion()).toBe(1);
    });
  });

  describe('type validation', () => {
    it('should validate theme values', () => {
      localStorageMock.setItem(
        'vexora-settings',
        JSON.stringify({
          value: {
            version: 1,
            settings: { theme: 'system' },
          },
        })
      );

      const settings = settingsStorage.getSettings();
      expect(settings.theme).toBe('system');
    });

    it('should validate fontSize values', () => {
      const validSizes = ['small', 'medium', 'large'] as const;

      for (const size of validSizes) {
        localStorageMock.setItem(
          'vexora-settings',
          JSON.stringify({
            value: {
              version: 1,
              settings: { fontSize: size },
            },
          })
        );

        const settings = settingsStorage.getSettings();
        expect(settings.fontSize).toBe(size);
      }
    });

    it('should default empty model to default', () => {
      localStorageMock.setItem(
        'vexora-settings',
        JSON.stringify({
          value: {
            version: 1,
            settings: { defaultModel: '' },
          },
        })
      );

      const settings = settingsStorage.getSettings();
      expect(settings.defaultModel).toBe(DEFAULT_SETTINGS.defaultModel);
    });
  });
});
