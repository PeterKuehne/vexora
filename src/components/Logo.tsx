/**
 * Logo Component
 *
 * Application logo/title for the header.
 * Features:
 * - Icon + Text combination
 * - Optional link to home
 * - Customizable size variants
 * - Theme-aware styling
 */

import { Bot } from 'lucide-react';
import { useTheme } from '../contexts';

export type LogoSize = 'sm' | 'md' | 'lg';

export interface LogoProps {
  /** Size variant */
  size?: LogoSize;
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Whether to show the text */
  showText?: boolean;
  /** Link URL (optional, wraps in anchor if provided) */
  href?: string;
  /** Click handler (optional, for SPA navigation) */
  onClick?: () => void;
  /** Custom className */
  className?: string;
}

/** Size configuration for each variant */
const sizeConfig: Record<LogoSize, { icon: number; text: string; gap: string }> = {
  sm: { icon: 16, text: 'text-base', gap: 'gap-1.5' },
  md: { icon: 20, text: 'text-lg', gap: 'gap-2' },
  lg: { icon: 24, text: 'text-xl', gap: 'gap-2.5' },
};

export function Logo({
  size = 'md',
  showIcon = true,
  showText = true,
  href,
  onClick,
  className = '',
}: LogoProps) {
  const { isDark } = useTheme();
  const config = sizeConfig[size];

  const content = (
    <span
      className={`
        flex items-center ${config.gap}
        font-semibold
        ${config.text}
        ${isDark ? 'text-white' : 'text-gray-900'}
        ${className}
      `.trim()}
    >
      {showIcon && (
        <span
          className={`
            flex items-center justify-center
            ${isDark ? 'text-primary' : 'text-primary'}
          `.trim()}
        >
          <Bot size={config.icon} />
        </span>
      )}
      {showText && <span>Vexora</span>}
    </span>
  );

  // If href is provided, wrap in anchor
  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        className={`
          inline-flex items-center
          transition-opacity hover:opacity-80
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm
        `.trim()}
      >
        {content}
      </a>
    );
  }

  // If onClick is provided without href, wrap in button
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          inline-flex items-center
          transition-opacity hover:opacity-80
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm
        `.trim()}
      >
        {content}
      </button>
    );
  }

  // Otherwise, just return the content as a heading
  return <h1 className="inline-flex">{content}</h1>;
}

/**
 * LogoIcon - Just the icon, useful for collapsed states
 */
export interface LogoIconProps {
  /** Size in pixels */
  size?: number;
  /** Custom className */
  className?: string;
}

export function LogoIcon({ size = 24, className = '' }: LogoIconProps) {
  const { isDark } = useTheme();

  return (
    <span
      className={`
        flex items-center justify-center
        ${isDark ? 'text-primary' : 'text-primary'}
        ${className}
      `.trim()}
    >
      <Bot size={size} />
    </span>
  );
}
