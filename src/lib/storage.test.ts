/**
 * StorageService Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StorageService, STORAGE_KEYS } from './storage';

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

// Apply mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    service = new StorageService('test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAvailable', () => {
    it('returns true when localStorage is available', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('get/set', () => {
    it('sets and gets a string value', () => {
      service.set('key1', 'hello');
      expect(service.get('key1')).toBe('hello');
    });

    it('sets and gets a number value', () => {
      service.set('key2', 42);
      expect(service.get('key2')).toBe(42);
    });

    it('sets and gets an object value', () => {
      const obj = { name: 'test', count: 5 };
      service.set('key3', obj);
      expect(service.get('key3')).toEqual(obj);
    });

    it('sets and gets an array value', () => {
      const arr = [1, 2, 3, { nested: true }];
      service.set('key4', arr);
      expect(service.get('key4')).toEqual(arr);
    });

    it('returns null for non-existent key', () => {
      expect(service.get('nonexistent')).toBeNull();
    });

    it('returns default value for non-existent key', () => {
      expect(service.get('nonexistent', 'default')).toBe('default');
    });

    it('uses prefix for keys', () => {
      service.set('mykey', 'value');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-mykey',
        expect.any(String)
      );
    });
  });

  describe('TTL (Time-to-Live)', () => {
    it('returns value before TTL expires', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      service.set('ttlkey', 'value', { ttl: 1000 });

      // Move time forward 500ms (still valid)
      vi.setSystemTime(now + 500);
      expect(service.get('ttlkey')).toBe('value');

      vi.useRealTimers();
    });

    it('returns null after TTL expires', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      service.set('ttlkey', 'value', { ttl: 1000 });

      // Move time forward 1500ms (expired)
      vi.setSystemTime(now + 1500);
      expect(service.get('ttlkey')).toBeNull();

      vi.useRealTimers();
    });

    it('returns default value after TTL expires', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      service.set('ttlkey', 'value', { ttl: 1000 });

      vi.setSystemTime(now + 1500);
      expect(service.get('ttlkey', 'default')).toBe('default');

      vi.useRealTimers();
    });
  });

  describe('remove', () => {
    it('removes a value', () => {
      service.set('key', 'value');
      expect(service.get('key')).toBe('value');

      service.remove('key');
      expect(service.get('key')).toBeNull();
    });

    it('returns true on success', () => {
      service.set('key', 'value');
      expect(service.remove('key')).toBe(true);
    });
  });

  describe('has', () => {
    it('returns true for existing key', () => {
      service.set('key', 'value');
      expect(service.has('key')).toBe(true);
    });

    it('returns false for non-existent key', () => {
      expect(service.has('nonexistent')).toBe(false);
    });
  });

  describe('keys', () => {
    it('returns all keys with prefix', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');

      const keys = service.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('does not include keys from other prefixes', () => {
      const otherService = new StorageService('other');
      otherService.set('otherkey', 'value');
      service.set('mykey', 'value');

      const keys = service.keys();
      expect(keys).toContain('mykey');
      expect(keys).not.toContain('otherkey');
    });
  });

  describe('clear', () => {
    it('removes all keys with prefix', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');

      service.clear();

      expect(service.has('key1')).toBe(false);
      expect(service.has('key2')).toBe(false);
    });
  });

  describe('getSize', () => {
    it('calculates approximate size in bytes', () => {
      service.set('key', 'value');
      const size = service.getSize();

      // Size should be > 0
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('has all expected keys', () => {
      expect(STORAGE_KEYS.CONVERSATIONS).toBe('conversations');
      expect(STORAGE_KEYS.ACTIVE_CONVERSATION_ID).toBe('active-conversation');
      expect(STORAGE_KEYS.SETTINGS).toBe('settings');
      expect(STORAGE_KEYS.THEME).toBe('theme');
      expect(STORAGE_KEYS.MODEL_CONFIG).toBe('model-config');
    });
  });
});
