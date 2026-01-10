/**
 * Skeleton Component
 *
 * Loading placeholder with animated shimmer effect.
 * Used for content that is still loading.
 */

import { cn } from '../utils';

// ============================================
// Base Skeleton
// ============================================

interface SkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Width (defaults to 100%) */
  width?: string | number;
  /** Height (defaults to 1rem) */
  height?: string | number;
  /** Whether to use rounded corners */
  rounded?: boolean | 'sm' | 'md' | 'lg' | 'full';
  /** Whether to animate */
  animate?: boolean;
}

export function Skeleton({
  className,
  width,
  height,
  rounded = 'md',
  animate = true,
}: SkeletonProps) {
  const roundedClass =
    rounded === true
      ? 'rounded'
      : rounded === 'sm'
        ? 'rounded-sm'
        : rounded === 'md'
          ? 'rounded-md'
          : rounded === 'lg'
            ? 'rounded-lg'
            : rounded === 'full'
              ? 'rounded-full'
              : '';

  return (
    <div
      className={cn(
        'bg-gray-200 dark:bg-gray-700',
        animate && 'animate-pulse',
        roundedClass,
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height ?? '1rem',
      }}
      aria-hidden="true"
    />
  );
}

// ============================================
// Skeleton Text Line
// ============================================

interface SkeletonTextProps {
  /** Number of lines */
  lines?: number;
  /** Width of last line (e.g., "75%") */
  lastLineWidth?: string;
  /** Gap between lines */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = '75%',
  gap = 'sm',
  className,
}: SkeletonTextProps) {
  const gapClass = gap === 'sm' ? 'space-y-2' : gap === 'md' ? 'space-y-3' : 'space-y-4';

  return (
    <div className={cn(gapClass, className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          height={14}
        />
      ))}
    </div>
  );
}

// ============================================
// Skeleton Avatar
// ============================================

interface SkeletonAvatarProps {
  /** Size of avatar */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  const sizeClass =
    size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-10 h-10' : 'w-12 h-12';

  return <Skeleton className={cn(sizeClass, className)} rounded="full" />;
}

// ============================================
// Skeleton Message (for chat)
// ============================================

interface SkeletonMessageProps {
  /** Whether this is a user message (right-aligned) */
  isUser?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonMessage({ isUser = false, className }: SkeletonMessageProps) {
  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className
      )}
      aria-hidden="true"
    >
      <SkeletonAvatar size="sm" />
      <div
        className={cn(
          'flex-1 max-w-[70%] space-y-2',
          isUser ? 'ml-auto' : 'mr-auto'
        )}
      >
        <Skeleton width={isUser ? '60%' : '80%'} height={16} />
        <Skeleton width={isUser ? '40%' : '60%'} height={16} />
        {!isUser && <Skeleton width="30%" height={16} />}
      </div>
    </div>
  );
}

// ============================================
// Skeleton Message List
// ============================================

interface SkeletonMessageListProps {
  /** Number of message skeletons to show */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonMessageList({ count = 3, className }: SkeletonMessageListProps) {
  return (
    <div className={cn('space-y-2', className)} aria-label="Nachrichten werden geladen">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMessage key={i} isUser={i % 2 === 0} />
      ))}
    </div>
  );
}

// ============================================
// Skeleton Conversation Item (for sidebar)
// ============================================

interface SkeletonConversationItemProps {
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonConversationItem({ className }: SkeletonConversationItemProps) {
  return (
    <div
      className={cn('flex items-start gap-3 p-3 rounded-lg', className)}
      aria-hidden="true"
    >
      <Skeleton width={20} height={20} rounded="sm" />
      <div className="flex-1 space-y-2">
        <Skeleton width="85%" height={14} />
        <Skeleton width="50%" height={12} />
      </div>
    </div>
  );
}

// ============================================
// Skeleton Conversation List
// ============================================

interface SkeletonConversationListProps {
  /** Number of items */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonConversationList({
  count = 5,
  className,
}: SkeletonConversationListProps) {
  return (
    <div className={cn('space-y-1', className)} aria-label="Unterhaltungen werden geladen">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonConversationItem key={i} />
      ))}
    </div>
  );
}
