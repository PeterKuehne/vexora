/**
 * useDebounce Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback, useDebouncedState, useThrottle } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value updates', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // Update value
    rerender({ value: 'updated' });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now value should be updated
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid updates', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // Rapid updates
    rerender({ value: 'update1' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: 'update2' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: 'final' });

    // Value should still be initial
    expect(result.current).toBe('initial');

    // Wait full delay after last update
    act(() => vi.advanceTimersByTime(300));

    // Should have final value, not intermediate ones
    expect(result.current).toBe('final');
  });

  it('should use custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    // 300ms should not be enough
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('initial');

    // 500ms should be enough
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('updated');
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce callback execution', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    // Call debounced callback
    act(() => {
      result.current.debouncedCallback('arg1');
    });

    // Callback should not be called immediately
    expect(callback).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);

    // Fast-forward time
    act(() => vi.advanceTimersByTime(300));

    // Now callback should be called
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
    expect(result.current.isPending).toBe(false);
  });

  it('should cancel pending callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current.debouncedCallback('arg1');
    });

    expect(result.current.isPending).toBe(true);

    // Cancel before timeout
    act(() => {
      result.current.cancel();
    });

    expect(result.current.isPending).toBe(false);

    // Fast-forward time
    act(() => vi.advanceTimersByTime(500));

    // Callback should not be called
    expect(callback).not.toHaveBeenCalled();
  });

  it('should flush pending callback immediately', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current.debouncedCallback('arg1');
    });

    // Flush immediately
    act(() => {
      result.current.flush();
    });

    // Callback should be called immediately
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
    expect(result.current.isPending).toBe(false);
  });

  it('should only call callback once for rapid invocations', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    // Rapid calls
    act(() => {
      result.current.debouncedCallback('arg1');
      result.current.debouncedCallback('arg2');
      result.current.debouncedCallback('arg3');
    });

    act(() => vi.advanceTimersByTime(300));

    // Should only be called once with last argument
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg3');
  });
});

describe('useDebouncedState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return immediate and debounced values', () => {
    const { result } = renderHook(() => useDebouncedState('initial', 300));

    const [value, debouncedValue, setValue] = result.current;
    expect(value).toBe('initial');
    expect(debouncedValue).toBe('initial');
    expect(typeof setValue).toBe('function');
  });

  it('should update immediate value instantly', () => {
    const { result } = renderHook(() => useDebouncedState('initial', 300));

    act(() => {
      result.current[2]('updated');
    });

    // Immediate value updates instantly
    expect(result.current[0]).toBe('updated');
    // Debounced value stays the same
    expect(result.current[1]).toBe('initial');
  });

  it('should update debounced value after delay', () => {
    const { result } = renderHook(() => useDebouncedState('initial', 300));

    act(() => {
      result.current[2]('updated');
    });

    act(() => vi.advanceTimersByTime(300));

    // Both should now be updated
    expect(result.current[0]).toBe('updated');
    expect(result.current[1]).toBe('updated');
  });
});

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useThrottle('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should update after scheduled timeout completes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottle(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // Update value - schedules a timeout
    rerender({ value: 'updated' });

    // Value not updated yet (waiting for throttle)
    expect(result.current).toBe('initial');

    // Wait for throttle interval to pass
    act(() => vi.advanceTimersByTime(300));

    // Now value should be updated
    expect(result.current).toBe('updated');
  });

  it('should throttle rapid updates', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottle(value, 300),
      { initialProps: { value: 'v1' } }
    );

    // Rapid updates within interval
    rerender({ value: 'v2' });
    expect(result.current).toBe('v1'); // Not enough time passed

    act(() => vi.advanceTimersByTime(100));
    rerender({ value: 'v3' });
    expect(result.current).toBe('v1'); // Still waiting

    // Complete the interval
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('v3');
  });
});
