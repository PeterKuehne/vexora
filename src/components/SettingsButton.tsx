/**
 * SettingsButton Component - Button to open Settings Modal
 * Uses Gear/Cog icon with hover animations
 */

import { Settings } from 'lucide-react';
import { useTheme } from '../contexts';

export interface SettingsButtonProps {
  /** Callback when button is clicked */
  onClick: () => void;
  /** Whether to show label text */
  showLabel?: boolean;
  /** Size of the button (affects icon and padding) */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Whether button is disabled */
  disabled?: boolean;
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
 * SettingsButton - Button to open settings modal with animated gear icon
 */
export function SettingsButton({
  onClick,
  showLabel = true,
  size = 'md',
  className = '',
  disabled = false,
}: SettingsButtonProps) {
  const { isDark } = useTheme();
  const sizeStyles = getSizeStyles(size);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group
        flex items-center gap-1.5
        ${sizeStyles.padding} ${sizeStyles.textSize}
        rounded-lg
        transition-all duration-200
        ${
          disabled
            ? isDark
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 cursor-not-allowed'
            : isDark
              ? 'text-gray-400 hover:text-white hover:bg-white/10'
              : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
        }
        ${className}
      `.trim()}
      title="Einstellungen"
      aria-label="Einstellungen öffnen"
    >
      {/* Animated Icon Container */}
      <span
        className={`
          relative inline-flex items-center justify-center
          transition-transform duration-300 ease-out
          ${!disabled && 'group-hover:scale-110 group-active:scale-95'}
        `}
      >
        <Settings
          size={sizeStyles.iconSize}
          className={`
            transition-all duration-300 ease-out
            ${!disabled && 'group-hover:rotate-45'}
          `}
        />
      </span>

      {/* Label */}
      {showLabel && (
        <span className="hidden sm:inline transition-opacity duration-200">
          Einstellungen
        </span>
      )}
    </button>
  );
}

/**
 * SettingsButtonIcon - Minimal version with just the icon (no label)
 */
export type SettingsButtonIconProps = Omit<SettingsButtonProps, 'showLabel'>;

export function SettingsButtonIcon({
  onClick,
  size = 'md',
  className = '',
  disabled = false,
}: SettingsButtonIconProps) {
  return (
    <SettingsButton
      onClick={onClick}
      showLabel={false}
      size={size}
      className={className}
      disabled={disabled}
    />
  );
}

export default SettingsButton;
