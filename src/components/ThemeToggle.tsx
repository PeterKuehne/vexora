/**
 * ThemeToggle Component - Toggle Button for Dark/Light/System Theme
 * Features Sun/Moon/Monitor icons with smooth animation on toggle
 */

import { type ComponentProps } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts';
import type { Theme } from '../types/settings';

export interface ThemeToggleProps {
  /** Current theme */
  theme: Theme;
  /** Callback when theme changes */
  onThemeChange: (theme: Theme) => void;
  /** Whether to show label text */
  showLabel?: boolean;
  /** Size of the toggle (affects icon and padding) */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Theme configuration for display
 */
interface ThemeConfig {
  Icon: typeof Sun | typeof Moon | typeof Monitor;
  label: string;
  ariaLabel: string;
}

/**
 * Get theme configuration for display
 */
function getThemeConfig(theme: Theme): ThemeConfig {
  switch (theme) {
    case 'light':
      return {
        Icon: Sun,
        label: 'Hell',
        ariaLabel: 'Helles Theme aktiv. Klicken für System-Theme.',
      };
    case 'system':
      return {
        Icon: Monitor,
        label: 'System',
        ariaLabel: 'System-Theme aktiv. Klicken für dunkles Theme.',
      };
    case 'dark':
    default:
      return {
        Icon: Moon,
        label: 'Dunkel',
        ariaLabel: 'Dunkles Theme aktiv. Klicken für helles Theme.',
      };
  }
}

/**
 * Cycle through themes: dark -> light -> system -> dark
 */
function getNextTheme(currentTheme: Theme): Theme {
  const themeOrder: Theme[] = ['dark', 'light', 'system'];
  const currentIndex = themeOrder.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themeOrder.length;
  return themeOrder[nextIndex];
}

/**
 * Get size-specific styles
 */
function getSizeStyles(size: 'sm' | 'md' | 'lg'): {
  iconSize: number;
  padding: string;
  textSize: string;
} {
  switch (size) {
    case 'sm':
      return { iconSize: 14, padding: 'px-1.5 py-1', textSize: 'text-xs' };
    case 'lg':
      return { iconSize: 20, padding: 'px-3 py-2', textSize: 'text-base' };
    case 'md':
    default:
      return { iconSize: 16, padding: 'px-2 py-1.5', textSize: 'text-sm' };
  }
}

/**
 * ThemeToggle - Button to cycle through themes with animated icon
 */
export function ThemeToggle({
  theme,
  onThemeChange,
  showLabel = true,
  size = 'md',
  className = '',
}: ThemeToggleProps) {
  const { isDark } = useTheme();
  const config = getThemeConfig(theme);
  const sizeStyles = getSizeStyles(size);

  const handleClick = () => {
    onThemeChange(getNextTheme(theme));
  };

  return (
    <button
      onClick={handleClick}
      className={`
        group
        flex items-center gap-1.5
        ${sizeStyles.padding} ${sizeStyles.textSize}
        rounded-lg
        transition-all duration-200
        ${
          isDark
            ? 'text-gray-400 hover:text-white hover:bg-white/10'
            : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
        }
        ${className}
      `.trim()}
      title={`Theme: ${config.label}`}
      aria-label={config.ariaLabel}
    >
      {/* Animated Icon Container */}
      <span
        className="
          relative inline-flex items-center justify-center
          transition-transform duration-300 ease-out
          group-hover:scale-110
          group-active:scale-95
        "
      >
        <config.Icon
          size={sizeStyles.iconSize}
          className="
            transition-all duration-300 ease-out
            group-hover:rotate-12
          "
        />
      </span>

      {/* Label */}
      {showLabel && (
        <span className="hidden sm:inline transition-opacity duration-200">
          {config.label}
        </span>
      )}
    </button>
  );
}

/**
 * ThemeToggleIcon - Minimal version with just the icon (no label)
 */
export type ThemeToggleIconProps = Omit<ThemeToggleProps, 'showLabel'> &
  ComponentProps<'button'>;

export function ThemeToggleIcon({
  theme,
  onThemeChange,
  size = 'md',
  className = '',
  ...buttonProps
}: ThemeToggleIconProps) {
  return (
    <ThemeToggle
      theme={theme}
      onThemeChange={onThemeChange}
      showLabel={false}
      size={size}
      className={className}
      {...(buttonProps as Omit<ComponentProps<'button'>, keyof ThemeToggleProps>)}
    />
  );
}

/**
 * ThemeTogglePill - Pill-shaped variant for more prominent display
 */
export interface ThemeTogglePillProps extends Omit<ThemeToggleProps, 'size'> {
  /** Whether the pill is currently active/pressed */
  isActive?: boolean;
}

export function ThemeTogglePill({
  theme,
  onThemeChange,
  showLabel = true,
  className = '',
  isActive = false,
}: ThemeTogglePillProps) {
  const { isDark } = useTheme();
  const config = getThemeConfig(theme);

  const handleClick = () => {
    onThemeChange(getNextTheme(theme));
  };

  return (
    <button
      onClick={handleClick}
      className={`
        group
        flex items-center gap-2
        px-4 py-2 text-sm font-medium
        rounded-full
        border
        transition-all duration-300 ease-out
        ${
          isActive
            ? isDark
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-black/10 border-black/20 text-gray-900'
            : isDark
              ? 'bg-transparent border-white/10 text-gray-400 hover:border-white/20 hover:text-white hover:bg-white/5'
              : 'bg-transparent border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 hover:bg-black/5'
        }
        ${className}
      `.trim()}
      title={`Theme: ${config.label}`}
      aria-label={config.ariaLabel}
      aria-pressed={isActive}
    >
      {/* Animated Icon */}
      <span
        className="
          inline-flex items-center justify-center
          transition-transform duration-300 ease-out
          group-hover:scale-110 group-hover:rotate-12
          group-active:scale-95
        "
      >
        <config.Icon size={18} />
      </span>

      {/* Label */}
      {showLabel && <span>{config.label}</span>}
    </button>
  );
}

export default ThemeToggle;
