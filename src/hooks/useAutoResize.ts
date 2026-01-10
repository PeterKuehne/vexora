/**
 * useAutoResize Hook
 *
 * Auto-resizing functionality for textarea elements.
 * Adjusts height based on content while respecting min/max bounds.
 *
 * @example
 * ```tsx
 * function TextareaComponent() {
 *   const textareaRef = useRef<HTMLTextAreaElement>(null);
 *   const { reset } = useAutoResize(textareaRef, {
 *     maxHeight: 200,
 *     minHeight: 40,
 *   });
 *
 *   const handleSubmit = () => {
 *     // Process content...
 *     reset(); // Reset to min height
 *   };
 *
 *   return <textarea ref={textareaRef} />;
 * }
 * ```
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react';

// ============================================
// Types
// ============================================

export interface UseAutoResizeOptions {
  /** Maximum height in pixels (default: 200) */
  maxHeight?: number;
  /** Minimum height in pixels (default: auto) */
  minHeight?: number;
  /** Dependency value to trigger resize (e.g., input value) */
  dependency?: unknown;
  /** Whether auto-resize is enabled (default: true) */
  enabled?: boolean;
}

export interface UseAutoResizeReturn {
  /** Reset textarea to min height */
  reset: () => void;
  /** Manually trigger resize calculation */
  resize: () => void;
  /** Current calculated height */
  height: number;
}

// ============================================
// useAutoResize Hook
// ============================================

/**
 * Hook for auto-resizing textarea elements based on content
 *
 * @param ref - RefObject pointing to the textarea element
 * @param options - Configuration options
 * @returns Object with reset, resize functions and current height
 */
export function useAutoResize(
  ref: RefObject<HTMLTextAreaElement | null>,
  options: UseAutoResizeOptions = {}
): UseAutoResizeReturn {
  const {
    maxHeight = 200,
    minHeight,
    dependency,
    enabled = true,
  } = options;

  // Track current height
  const heightRef = useRef(minHeight ?? 0);

  /**
   * Calculate and apply the optimal height
   */
  const resize = useCallback(() => {
    const textarea = ref.current;
    if (!textarea || !enabled) return;

    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height
    const scrollHeight = textarea.scrollHeight;
    let newHeight = scrollHeight;

    // Apply min constraint
    if (minHeight !== undefined && newHeight < minHeight) {
      newHeight = minHeight;
    }

    // Apply max constraint
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }

    // Apply the height
    textarea.style.height = `${newHeight}px`;
    heightRef.current = newHeight;
  }, [ref, maxHeight, minHeight, enabled]);

  /**
   * Reset textarea to minimum height
   */
  const reset = useCallback(() => {
    const textarea = ref.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';

    if (minHeight !== undefined) {
      textarea.style.height = `${minHeight}px`;
      heightRef.current = minHeight;
    } else {
      heightRef.current = 0;
    }
  }, [ref, minHeight]);

  // Resize on dependency change
  useEffect(() => {
    if (enabled) {
      resize();
    }
  }, [dependency, resize, enabled]);

  // Initial setup
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea || !enabled) return;

    // Set initial min-height if specified
    if (minHeight !== undefined) {
      textarea.style.minHeight = `${minHeight}px`;
    }

    // Set initial overflow
    textarea.style.overflowY = 'hidden';

    // Initial resize
    resize();
  }, [ref, resize, minHeight, enabled]);

  return {
    reset,
    resize,
    get height() {
      return heightRef.current;
    },
  };
}

// ============================================
// useAutoResizeValue Hook - Simplified version
// ============================================

/**
 * Simplified hook that takes a value directly instead of a ref dependency
 *
 * @example
 * ```tsx
 * const textareaRef = useRef<HTMLTextAreaElement>(null);
 * const [value, setValue] = useState('');
 * const { reset } = useAutoResizeValue(textareaRef, value);
 * ```
 */
export function useAutoResizeValue(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  options: Omit<UseAutoResizeOptions, 'dependency'> = {}
): UseAutoResizeReturn {
  return useAutoResize(ref, {
    ...options,
    dependency: value,
  });
}

// ============================================
// useAutoResizeTextarea Hook - Complete solution
// ============================================

export interface UseAutoResizeTextareaOptions {
  /** Maximum height in pixels (default: 200) */
  maxHeight?: number;
  /** Minimum height in pixels (default: 40) */
  minHeight?: number;
  /** Initial value */
  initialValue?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
}

export interface UseAutoResizeTextareaReturn {
  /** Ref to attach to textarea */
  ref: RefObject<HTMLTextAreaElement | null>;
  /** Current value */
  value: string;
  /** Set the value */
  setValue: (value: string) => void;
  /** Reset value and height */
  reset: () => void;
  /** Manually trigger resize */
  resize: () => void;
}

/**
 * Complete hook that manages both value and auto-resize
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const { ref, value, setValue, reset } = useAutoResizeTextarea({
 *     maxHeight: 200,
 *     onChange: (v) => console.log('Changed:', v),
 *   });
 *
 *   const handleSubmit = () => {
 *     sendMessage(value);
 *     reset();
 *   };
 *
 *   return (
 *     <textarea
 *       ref={ref}
 *       value={value}
 *       onChange={(e) => setValue(e.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function useAutoResizeTextarea(
  options: UseAutoResizeTextareaOptions = {}
): UseAutoResizeTextareaReturn {
  const {
    maxHeight = 200,
    minHeight = 40,
    initialValue = '',
    onChange,
  } = options;

  const ref = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(initialValue);

  // Use a callback ref pattern to avoid stale closures
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { reset: resetHeight, resize } = useAutoResize(ref, {
    maxHeight,
    minHeight,
    dependency: valueRef.current,
  });

  /**
   * Update value and trigger resize
   */
  const setValue = useCallback((newValue: string) => {
    valueRef.current = newValue;
    onChangeRef.current?.(newValue);

    // Force re-render by scheduling resize
    requestAnimationFrame(() => {
      resize();
    });
  }, [resize]);

  /**
   * Reset both value and height
   */
  const reset = useCallback(() => {
    valueRef.current = '';
    onChangeRef.current?.('');
    resetHeight();
  }, [resetHeight]);

  return {
    ref,
    get value() {
      return valueRef.current;
    },
    setValue,
    reset,
    resize,
  };
}

