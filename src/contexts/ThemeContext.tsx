/**
 * ThemeContext
 *
 * Manages dark/light mode with:
 * - Theme toggle (light, dark, system)
 * - System preference detection
 * - LocalStorage persistence via SettingsStorage
 * - Applies theme class to document element
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
import type { Theme } from '../types/settings';

// ============================================
// Context Types
// ============================================

interface ThemeContextValue {
  /** Current theme setting (light, dark, or system) */
  theme: Theme;
  /** Resolved theme (always light or dark, never system) */
  resolvedTheme: 'light' | 'dark';
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** Whether using system preference */
  isSystem: boolean;
  /** Set the theme */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
}

// ============================================
// Context
// ============================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================
// System Preference Detection
// ============================================

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Subscribe to system theme changes
 */
function subscribeToSystemTheme(
  callback: (theme: 'light' | 'dark') => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (event: MediaQueryListEvent) => {
    callback(event.matches ? 'dark' : 'light');
  };

  // Modern browsers
  mediaQuery.addEventListener('change', handler);

  return () => {
    mediaQuery.removeEventListener('change', handler);
  };
}

// ============================================
// Theme Application
// ============================================

/**
 * Apply theme to the document
 */
function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Remove both classes first
  root.classList.remove('light', 'dark');

  // Add the appropriate class
  root.classList.add(theme);

  // Also set a data attribute for additional styling options
  root.setAttribute('data-theme', theme);

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      theme === 'dark' ? '#0a0a0a' : '#ffffff'
    );
  }
}

// ============================================
// Provider Component
// ============================================

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme if none is stored */
  defaultTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
}: ThemeProviderProps) {
  // Load theme from storage (lazy init)
  const [theme, setThemeState] = useState<Theme>(() => {
    const storedTheme = settingsStorage.getSetting('theme');
    return storedTheme || defaultTheme;
  });

  // Track system preference
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    getSystemTheme()
  );

  // Resolve the actual theme to apply
  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  // Subscribe to system preference changes
  useEffect(() => {
    return subscribeToSystemTheme((newSystemTheme) => {
      setSystemTheme(newSystemTheme);
    });
  }, []);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Subscribe to cross-tab settings changes
  useEffect(() => {
    return settingsStorage.subscribe((settings) => {
      if (settings && settings.theme !== theme) {
        setThemeState(settings.theme);
      }
    });
  }, [theme]);

  /**
   * Set the theme and persist to storage
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    settingsStorage.setSetting('theme', newTheme);
  }, []);

  /**
   * Toggle between light and dark
   * If currently on 'system', switches to opposite of system preference
   */
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Derived values
  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  const value: ThemeContextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      isSystem,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, isDark, isSystem, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

/**
 * Hook to access theme context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, isDark, toggleTheme } = useTheme();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       Current: {isDark ? 'Dark' : 'Light'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}

// ============================================
// Utility Exports
// ============================================

export { getSystemTheme, applyTheme };
