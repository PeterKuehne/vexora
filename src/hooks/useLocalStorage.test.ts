/**
 * Tests for useLocalStorage Hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useLocalStorage,
  useLocalStorageState,
  useLocalStorageFlag,
} from './useLocalStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return default value when storage is empty', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'default')
      );

      expect(result.current.value).toBe('default');
    });

    it('should return stored value when it exists', () => {
      // Pre-populate storage
      localStorageMock.setItem(
        'qwen-chat-test-key',
        JSON.stringify({ value: 'stored' })
      );

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'default')
      );

      expect(result.current.value).toBe('stored');
    });

    it('should update value in state and storage', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      );

      act(() => {
        result.current.setValue('updated');
      });

      expect(result.current.value).toBe('updated');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'qwen-chat-test-key',
        JSON.stringify({ value: 'updated' })
      );
    });

    it('should support functional updates', () => {
      const { result } = renderHook(() => useLocalStorage('counter', 0));

      act(() => {
        result.current.setValue((prev) => prev + 1);
      });

      expect(result.current.value).toBe(1);

      act(() => {
        result.current.setValue((prev) => prev + 10);
      });

      expect(result.current.value).toBe(11);
    });

    it('should remove value and reset to default', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'default')
      );

      act(() => {
        result.current.setValue('custom');
      });
      expect(result.current.value).toBe('custom');

      act(() => {
        result.current.removeValue();
      });

      expect(result.current.value).toBe('default');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'qwen-chat-test-key'
      );
    });
  });

  describe('different types', () => {
    it('should handle string values', () => {
      const { result } = renderHook(() => useLocalStorage('str', 'hello'));

      act(() => {
        result.current.setValue('world');
      });

      expect(result.current.value).toBe('world');
    });

    it('should handle number values', () => {
      const { result } = renderHook(() => useLocalStorage('num', 42));

      act(() => {
        result.current.setValue(100);
      });

      expect(result.current.value).toBe(100);
    });

    it('should handle boolean values', () => {
      const { result } = renderHook(() => useLocalStorage('bool', false));

      act(() => {
        result.current.setValue(true);
      });

      expect(result.current.value).toBe(true);
    });

    it('should handle object values', () => {
      const { result } = renderHook(() =>
        useLocalStorage('obj', { name: 'test', count: 0 })
      );

      act(() => {
        result.current.setValue({ name: 'updated', count: 5 });
      });

      expect(result.current.value).toEqual({ name: 'updated', count: 5 });
    });

    it('should handle array values', () => {
      const { result } = renderHook(() =>
        useLocalStorage<string[]>('arr', ['a', 'b'])
      );

      act(() => {
        result.current.setValue(['x', 'y', 'z']);
      });

      expect(result.current.value).toEqual(['x', 'y', 'z']);
    });

    it('should handle null values', () => {
      const { result } = renderHook(() =>
        useLocalStorage<string | null>('nullable', null)
      );

      act(() => {
        result.current.setValue('not null');
      });
      expect(result.current.value).toBe('not null');

      act(() => {
        result.current.setValue(null);
      });
      expect(result.current.value).toBe(null);
    });
  });

  describe('isAvailable', () => {
    it('should report storage availability', () => {
      const { result } = renderHook(() => useLocalStorage('test', 'value'));

      expect(result.current.isAvailable).toBe(true);
    });
  });

  describe('refresh', () => {
    it('should refresh value from storage', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'default')
      );

      expect(result.current.value).toBe('default');

      // Simulate external change to storage
      localStorageMock.setItem(
        'qwen-chat-test-key',
        JSON.stringify({ value: 'external-update' })
      );

      act(() => {
        result.current.refresh();
      });

      expect(result.current.value).toBe('external-update');
    });
  });
});

describe('useLocalStorageState', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should work like useState with localStorage persistence', () => {
    const { result } = renderHook(() => useLocalStorageState('state-key', 0));

    const [value, setValue] = result.current;
    expect(value).toBe(0);

    act(() => {
      setValue(5);
    });

    expect(result.current[0]).toBe(5);
  });

  it('should support functional updates', () => {
    const { result } = renderHook(() =>
      useLocalStorageState('counter', 10)
    );

    act(() => {
      result.current[1]((prev) => prev * 2);
    });

    expect(result.current[0]).toBe(20);
  });
});

describe('useLocalStorageFlag', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should return default value', () => {
    const { result } = renderHook(() => useLocalStorageFlag('flag', false));

    expect(result.current.isEnabled).toBe(false);
  });

  it('should toggle value', () => {
    const { result } = renderHook(() => useLocalStorageFlag('flag', false));

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isEnabled).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isEnabled).toBe(false);
  });

  it('should enable value', () => {
    const { result } = renderHook(() => useLocalStorageFlag('flag', false));

    act(() => {
      result.current.enable();
    });

    expect(result.current.isEnabled).toBe(true);
  });

  it('should disable value', () => {
    const { result } = renderHook(() => useLocalStorageFlag('flag', true));

    act(() => {
      result.current.disable();
    });

    expect(result.current.isEnabled).toBe(false);
  });

  it('should set specific value', () => {
    const { result } = renderHook(() => useLocalStorageFlag('flag', false));

    act(() => {
      result.current.setValue(true);
    });
    expect(result.current.isEnabled).toBe(true);

    act(() => {
      result.current.setValue(false);
    });
    expect(result.current.isEnabled).toBe(false);
  });
});
