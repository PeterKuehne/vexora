/**
 * SearchInput Component
 *
 * Search input for filtering conversations and other content.
 * Features:
 * - Search icon prefix
 * - Clear button when value present
 * - Debounced onChange for performance
 * - Loading state indicator
 */

import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  type InputHTMLAttributes,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '../utils';
import { useDebounce } from '../hooks';

// ============================================
// Types
// ============================================

export interface SearchInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value' | 'type' | 'onSubmit' | 'size' | 'onSelect'
  > {
  /** Current search value */
  value?: string | undefined;
  /** Called when search value changes (debounced) */
  onChange?: (value: string) => void;
  /** Called immediately on input (not debounced) */
  onChangeImmediate?: (value: string) => void;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Whether search is loading */
  isLoading?: boolean;
  /** Show clear button */
  showClear?: boolean;
  /** Called when Enter is pressed */
  onSearchSubmit?: (value: string) => void;
  /** Called when Escape is pressed */
  onCancel?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'filled' | 'ghost';
  /** Optional className */
  className?: string;
}

export interface SearchInputRef {
  /** Focus the input */
  focus: () => void;
  /** Blur the input */
  blur: () => void;
  /** Clear the value */
  clear: () => void;
  /** Get current value */
  getValue: () => string;
  /** Get underlying input element */
  getElement: () => HTMLInputElement | null;
}

// ============================================
// Styles
// ============================================

const sizeStyles = {
  sm: {
    input: 'h-8 text-sm pl-8 pr-8',
    icon: 'w-4 h-4 left-2',
    clear: 'w-4 h-4 right-2',
  },
  md: {
    input: 'h-10 text-base pl-10 pr-10',
    icon: 'w-5 h-5 left-3',
    clear: 'w-5 h-5 right-3',
  },
  lg: {
    input: 'h-12 text-lg pl-12 pr-12',
    icon: 'w-6 h-6 left-4',
    clear: 'w-6 h-6 right-4',
  },
};

const variantStyles = {
  default: 'bg-transparent border border-white/10 focus:border-primary/50',
  filled: 'bg-surface border-none',
  ghost: 'bg-transparent border-none hover:bg-white/5',
};

// ============================================
// SearchInput Component
// ============================================

export const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(
  function SearchInput(
    {
      value: controlledValue,
      onChange,
      onChangeImmediate,
      debounceMs = 300,
      isLoading = false,
      showClear = true,
      onSearchSubmit,
      onCancel,
      size = 'md',
      variant = 'default',
      className,
      placeholder = 'Suchen...',
      disabled,
      ...rest
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Internal value state (for uncontrolled or controlled mode)
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState(controlledValue ?? '');
    const currentValue = isControlled ? controlledValue : internalValue;

    // Debounced value for onChange callback
    const debouncedValue = useDebounce(currentValue, debounceMs);

    // Track if debounced onChange should fire
    const shouldFireOnChange = useRef(false);

    // Call debounced onChange when debouncedValue changes
    useEffect(() => {
      if (shouldFireOnChange.current && onChange) {
        onChange(debouncedValue);
      }
      shouldFireOnChange.current = true;
    }, [debouncedValue, onChange]);

    // Sync internal value with controlled value
    useEffect(() => {
      if (isControlled) {
        setInternalValue(controlledValue);
      }
    }, [isControlled, controlledValue]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => {
        setInternalValue('');
        shouldFireOnChange.current = true;
        if (onChange) {
          onChange('');
        }
        if (onChangeImmediate) {
          onChangeImmediate('');
        }
        inputRef.current?.focus();
      },
      getValue: () => currentValue,
      getElement: () => inputRef.current,
    }));

    /**
     * Handle input change
     */
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      shouldFireOnChange.current = true;

      // Immediate callback (not debounced)
      if (onChangeImmediate) {
        onChangeImmediate(newValue);
      }
    };

    /**
     * Handle clear button click
     */
    const handleClear = () => {
      setInternalValue('');
      shouldFireOnChange.current = true;
      if (onChange) {
        onChange('');
      }
      if (onChangeImmediate) {
        onChangeImmediate('');
      }
      inputRef.current?.focus();
    };

    /**
     * Handle keyboard events
     */
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearchSubmit) {
        e.preventDefault();
        onSearchSubmit(currentValue);
      } else if (e.key === 'Escape') {
        if (currentValue && showClear) {
          // First Escape clears the input
          handleClear();
        } else if (onCancel) {
          // Second Escape or no value calls onCancel
          onCancel();
        }
      }
    };

    const styles = sizeStyles[size];
    const hasValue = currentValue.length > 0;

    return (
      <div className={cn('relative', className)}>
        {/* Search Icon */}
        <Search
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none',
            styles.icon
          )}
        />

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          value={currentValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            // Base styles
            'w-full rounded-lg outline-none transition-colors',
            // Text
            'text-white placeholder:text-gray-500',
            // Disabled
            'disabled:opacity-50 disabled:cursor-not-allowed',
            // Hide native search cancel button
            '[&::-webkit-search-cancel-button]:hidden',
            // Size styles
            styles.input,
            // Variant styles
            variantStyles[variant],
            // Focus ring
            'focus:ring-2 focus:ring-primary/30'
          )}
          {...rest}
        />

        {/* Clear Button or Loading Indicator */}
        {hasValue && showClear && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 p-1 rounded transition-colors',
              'text-gray-500 hover:text-gray-300 hover:bg-white/10',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              styles.clear
            )}
            title="Suche leeren"
            aria-label="Suche leeren"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
            ) : (
              <X size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
            )}
          </button>
        )}

        {/* Loading indicator when no value */}
        {!hasValue && isLoading && (
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 pointer-events-none',
              styles.clear
            )}
          >
            <Loader2
              className="animate-spin text-gray-500"
              size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16}
            />
          </div>
        )}
      </div>
    );
  }
);

// ============================================
// SearchInputCompact - Minimal version
// ============================================

export interface SearchInputCompactProps {
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Optional className */
  className?: string;
}

/**
 * Compact search input without debouncing
 */
export function SearchInputCompact({
  value,
  onChange,
  placeholder = 'Suchen...',
  className,
}: SearchInputCompactProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full h-8 pl-8 pr-8 rounded-md bg-white/5 text-sm',
          'text-white placeholder:text-gray-500',
          'outline-none border border-transparent',
          'focus:border-primary/50 focus:bg-white/10',
          '[&::-webkit-search-cancel-button]:hidden'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-500 hover:text-gray-300"
          title="Suche leeren"
          aria-label="Suche leeren"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ============================================
// SearchInputWithResults - For search with dropdown
// ============================================

export interface SearchResult {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface SearchInputWithResultsProps extends Omit<SearchInputProps, 'onSelect' | 'results'> {
  /** Search results to display */
  searchResults?: SearchResult[];
  /** Called when a result is selected */
  onResultSelect?: (result: SearchResult) => void;
  /** Show results dropdown */
  showResultsDropdown?: boolean;
  /** No results message */
  noResultsMessage?: string;
}

/**
 * Search input with dropdown results
 */
export function SearchInputWithResults({
  searchResults = [],
  onResultSelect,
  showResultsDropdown = true,
  noResultsMessage = 'Keine Ergebnisse gefunden',
  value,
  onChange,
  ...props
}: SearchInputWithResultsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const hasResults = searchResults.length > 0;
  const showDropdown = showResultsDropdown && isOpen && value && value.length > 0;

  const handleSelect = (result: SearchResult) => {
    onResultSelect?.(result);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
          handleSelect(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative">
      <SearchInput
        value={value}
        onChange={(v) => {
          onChange?.(v);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        {...props}
      />

      {/* Results Dropdown */}
      {showDropdown && (
        <div
          className={cn(
            'absolute z-50 w-full mt-1 py-1 rounded-lg shadow-lg',
            'bg-surface border border-white/10',
            'max-h-60 overflow-y-auto'
          )}
        >
          {hasResults ? (
            searchResults.map((result, index) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                className={cn(
                  'w-full px-3 py-2 text-left transition-colors',
                  'hover:bg-white/5',
                  index === highlightedIndex && 'bg-white/10'
                )}
              >
                <div className="flex items-center gap-2">
                  {result.icon}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">
                      {result.label}
                    </div>
                    {result.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {result.description}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              {noResultsMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
