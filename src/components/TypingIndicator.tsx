/**
 * TypingIndicator Component
 *
 * Animation shown while AI is generating a response.
 * Features:
 * - Three pulsing dots with staggered animation
 * - Optional text label
 * - Multiple size variants
 * - Theme-aware styling
 */

import { useTheme } from '../contexts';

// ============================================
// Types
// ============================================

export type TypingIndicatorSize = 'sm' | 'md' | 'lg';
export type TypingIndicatorVariant = 'dots' | 'pulse' | 'wave';

export interface TypingIndicatorProps {
  /** Size of the indicator */
  size?: TypingIndicatorSize;
  /** Visual variant */
  variant?: TypingIndicatorVariant;
  /** Optional text label to display */
  text?: string;
  /** Whether to show the text label */
  showText?: boolean;
  /** Optional className */
  className?: string;
}

export interface TypingIndicatorDotsProps {
  /** Size of the dots */
  size?: TypingIndicatorSize;
  /** Optional className */
  className?: string;
}

export interface TypingIndicatorWithAvatarProps extends TypingIndicatorProps {
  /** Avatar element to display */
  avatar?: React.ReactNode;
}

// ============================================
// Size Configuration
// ============================================

const sizeConfig = {
  sm: {
    dot: 'w-1.5 h-1.5',
    gap: 'gap-1',
    text: 'text-xs',
    container: 'gap-1.5',
  },
  md: {
    dot: 'w-2 h-2',
    gap: 'gap-1',
    text: 'text-sm',
    container: 'gap-2',
  },
  lg: {
    dot: 'w-2.5 h-2.5',
    gap: 'gap-1.5',
    text: 'text-base',
    container: 'gap-2.5',
  },
};

// ============================================
// TypingIndicator Component
// ============================================

export function TypingIndicator({
  size = 'md',
  variant = 'dots',
  text = 'Denke nach...',
  showText = true,
  className = '',
}: TypingIndicatorProps) {
  const { isDark } = useTheme();
  const config = sizeConfig[size];

  return (
    <div
      className={`
        flex items-center ${config.container}
        ${isDark ? 'text-gray-400' : 'text-gray-500'}
        ${className}
      `.trim()}
      role="status"
      aria-label={text}
      aria-live="polite"
    >
      {variant === 'dots' && <TypingDots size={size} />}
      {variant === 'pulse' && <TypingPulse size={size} />}
      {variant === 'wave' && <TypingWave size={size} />}

      {showText && (
        <span className={config.text}>{text}</span>
      )}
    </div>
  );
}

// ============================================
// TypingDots - Three bouncing dots
// ============================================

export function TypingDots({ size = 'md', className = '' }: TypingIndicatorDotsProps) {
  const { isDark } = useTheme();
  const config = sizeConfig[size];

  return (
    <div className={`flex ${config.gap} ${className}`} aria-hidden="true">
      <div
        className={`
          ${config.dot} rounded-full
          ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          animate-bounce
        `.trim()}
        style={{
          animationDuration: '1s',
          animationDelay: '0ms',
          animationTimingFunction: 'ease-in-out',
        }}
      />
      <div
        className={`
          ${config.dot} rounded-full
          ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          animate-bounce
        `.trim()}
        style={{
          animationDuration: '1s',
          animationDelay: '150ms',
          animationTimingFunction: 'ease-in-out',
        }}
      />
      <div
        className={`
          ${config.dot} rounded-full
          ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          animate-bounce
        `.trim()}
        style={{
          animationDuration: '1s',
          animationDelay: '300ms',
          animationTimingFunction: 'ease-in-out',
        }}
      />
    </div>
  );
}

// ============================================
// TypingPulse - Pulsing dots with opacity
// ============================================

export function TypingPulse({ size = 'md', className = '' }: TypingIndicatorDotsProps) {
  const { isDark } = useTheme();
  const config = sizeConfig[size];

  return (
    <div className={`flex ${config.gap} ${className}`} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`
            ${config.dot} rounded-full
            ${isDark ? 'bg-primary' : 'bg-primary'}
          `.trim()}
          style={{
            animation: 'typingPulse 1.4s ease-in-out infinite',
            animationDelay: `${index * 200}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes typingPulse {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================
// TypingWave - Wave animation effect
// ============================================

export function TypingWave({ size = 'md', className = '' }: TypingIndicatorDotsProps) {
  const { isDark } = useTheme();
  const config = sizeConfig[size];

  return (
    <div className={`flex items-end ${config.gap} ${className}`} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`
            ${config.dot} rounded-full
            ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          `.trim()}
          style={{
            animation: 'typingWave 1.2s ease-in-out infinite',
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes typingWave {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}

// ============================================
// TypingIndicatorWithAvatar - With bot avatar
// ============================================

export function TypingIndicatorWithAvatar({
  avatar,
  size = 'md',
  variant = 'dots',
  text = 'Denke nach...',
  showText = true,
  className = '',
}: TypingIndicatorWithAvatarProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        flex items-start gap-3
        ${className}
      `.trim()}
    >
      {/* Avatar */}
      {avatar && (
        <div
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            ${isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600'}
          `.trim()}
        >
          {avatar}
        </div>
      )}

      {/* Typing bubble */}
      <div
        className={`
          px-4 py-3 rounded-2xl rounded-tl-sm
          ${isDark ? 'bg-white/5' : 'bg-gray-100'}
        `.trim()}
      >
        <TypingIndicator
          size={size}
          variant={variant}
          text={text}
          showText={showText}
        />
      </div>
    </div>
  );
}

// ============================================
// TypingIndicatorInline - Compact inline version
// ============================================

export interface TypingIndicatorInlineProps {
  /** Optional className */
  className?: string;
}

export function TypingIndicatorInline({ className = '' }: TypingIndicatorInlineProps) {
  const { isDark } = useTheme();

  return (
    <span
      className={`
        inline-flex items-center gap-0.5
        ${className}
      `.trim()}
      role="status"
      aria-label="Schreibt..."
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`
            inline-block w-1 h-1 rounded-full
            ${isDark ? 'bg-gray-500' : 'bg-gray-400'}
          `.trim()}
          style={{
            animation: 'typingInline 1s ease-in-out infinite',
            animationDelay: `${index * 150}ms`,
          }}
          aria-hidden="true"
        />
      ))}
      <style>{`
        @keyframes typingInline {
          0%, 80%, 100% {
            opacity: 0.3;
          }
          40% {
            opacity: 1;
          }
        }
      `}</style>
    </span>
  );
}

// ============================================
// TypingIndicatorBubble - Standalone chat bubble
// ============================================

export interface TypingIndicatorBubbleProps {
  /** Size of the indicator */
  size?: TypingIndicatorSize;
  /** Optional className */
  className?: string;
}

export function TypingIndicatorBubble({
  size = 'md',
  className = '',
}: TypingIndicatorBubbleProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        inline-flex items-center px-4 py-3 rounded-2xl
        ${isDark ? 'bg-white/5' : 'bg-gray-100'}
        ${className}
      `.trim()}
    >
      <TypingIndicator size={size} showText={false} />
    </div>
  );
}
