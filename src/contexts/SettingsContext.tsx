/**
 * SettingsContext
 *
 * Manages global application settings with:
 * - Full settings state management
 * - LocalStorage persistence via SettingsStorage
 * - Cross-tab synchronization
 * - Partial settings updates
 * - Reset to defaults
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { settingsStorage } from '../lib/settingsStorage';
import type { AppSettings, FontSize } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

// ============================================
// Context Types
// ============================================

interface SettingsContextValue {
  /** Current settings */
  settings: AppSettings;
  /** Update a single setting */
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** Update multiple settings at once */
  updateSettings: (updates: Partial<AppSettings>) => void;
  /** Reset all settings to defaults */
  resetSettings: () => void;
  /** Get the default settings */
  getDefaults: () => AppSettings;
}

// ============================================
// Context
// ============================================

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  // Load settings from storage (lazy init)
  const [settings, setSettings] = useState<AppSettings>(() => {
    return settingsStorage.getSettings();
  });

  // Subscribe to cross-tab settings changes
  useEffect(() => {
    return settingsStorage.subscribe((newSettings) => {
      if (newSettings) {
        setSettings(newSettings);
      }
    });
  }, []);

  /**
   * Update a single setting
   */
  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((current) => {
        const updated = { ...current, [key]: value };
        settingsStorage.saveSettings(updated);
        return updated;
      });
    },
    []
  );

  /**
   * Update multiple settings at once
   */
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((current) => {
      const updated = { ...current, ...updates };
      settingsStorage.saveSettings(updated);
      return updated;
    });
  }, []);

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    settingsStorage.resetSettings();
  }, []);

  /**
   * Get the default settings
   */
  const getDefaults = useCallback(() => {
    return { ...DEFAULT_SETTINGS };
  }, []);

  const value: SettingsContextValue = useMemo(
    () => ({
      settings,
      updateSetting,
      updateSettings,
      resetSettings,
      getDefaults,
    }),
    [settings, updateSetting, updateSettings, resetSettings, getDefaults]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook to access the full settings context
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { settings, updateSetting, resetSettings } = useSettings();
 *
 *   return (
 *     <div>
 *       <label>
 *         Send on Enter:
 *         <input
 *           type="checkbox"
 *           checked={settings.sendOnEnter}
 *           onChange={(e) => updateSetting('sendOnEnter', e.target.checked)}
 *         />
 *       </label>
 *       <button onClick={resetSettings}>Reset to Defaults</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }

  return context;
}

// ============================================
// Convenience Hooks
// ============================================

/**
 * Hook to access and update a specific setting
 *
 * @example
 * ```tsx
 * function FontSizeSelector() {
 *   const [fontSize, setFontSize] = useSetting('fontSize');
 *
 *   return (
 *     <select value={fontSize} onChange={(e) => setFontSize(e.target.value as FontSize)}>
 *       <option value="small">Small</option>
 *       <option value="medium">Medium</option>
 *       <option value="large">Large</option>
 *     </select>
 *   );
 * }
 * ```
 */
export function useSetting<K extends keyof AppSettings>(
  key: K
): [AppSettings[K], (value: AppSettings[K]) => void] {
  const { settings, updateSetting } = useSettings();

  const setValue = useCallback(
    (value: AppSettings[K]) => {
      updateSetting(key, value);
    },
    [key, updateSetting]
  );

  return [settings[key], setValue];
}

/**
 * Hook to access font size settings with CSS class helper
 */
export function useFontSize(): {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontSizeClass: string;
} {
  const [fontSize, setFontSize] = useSetting('fontSize');

  const fontSizeClass = useMemo(() => {
    switch (fontSize) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-lg';
      case 'medium':
      default:
        return 'text-base';
    }
  }, [fontSize]);

  return { fontSize, setFontSize, fontSizeClass };
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeatureEnabled(
  feature: 'sendOnEnter' | 'showTimestamps' | 'enableStreaming' | 'showMarkdownPreview'
): boolean {
  const { settings } = useSettings();
  return settings[feature];
}

// ============================================
// Type Exports
// ============================================

export type { SettingsContextValue };
