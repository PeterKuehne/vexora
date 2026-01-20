/**
 * StorageService - Type-safe LocalStorage Operations
 *
 * Features:
 * - Generic get/set/remove methods with TypeScript type safety
 * - Automatic JSON serialization/deserialization
 * - Error handling with fallback values
 * - Optional TTL (time-to-live) for cached values
 * - Storage event listeners for cross-tab sync
 */

// ============================================
// Types
// ============================================

/**
 * Wrapper for stored values with optional expiry
 */
interface StorageItem<T> {
  value: T;
  /** Expiry timestamp in milliseconds (optional) */
  expiresAt?: number;
}

/**
 * Options for setting a value
 */
interface SetOptions {
  /** Time-to-live in milliseconds (optional) */
  ttl?: number;
}

/**
 * Storage event callback
 */
type StorageListener<T> = (newValue: T | null, oldValue: T | null) => void;

// ============================================
// Storage Service Class
// ============================================

export class StorageService {
  private prefix: string;
  private listeners: Map<string, Set<StorageListener<unknown>>>;

  /**
   * Create a new StorageService
   * @param prefix - Optional prefix for all keys (e.g., 'qwen-chat')
   */
  constructor(prefix = '') {
    this.prefix = prefix ? `${prefix}-` : '';
    this.listeners = new Map();

    // Listen for storage events from other tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
    }
  }

  /**
   * Get the full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Handle storage events from other tabs
   */
  private handleStorageEvent(event: StorageEvent): void {
    if (!event.key?.startsWith(this.prefix)) return;

    const key = event.key.slice(this.prefix.length);
    const listeners = this.listeners.get(key);
    if (!listeners) return;

    const oldValue = event.oldValue ? this.parseValue(event.oldValue) : null;
    const newValue = event.newValue ? this.parseValue(event.newValue) : null;

    listeners.forEach((listener) => {
      listener(newValue, oldValue);
    });
  }

  /**
   * Parse a stored JSON value
   */
  private parseValue<T>(json: string): T | null {
    try {
      const item = JSON.parse(json) as StorageItem<T>;

      // Check expiry
      if (item.expiresAt && Date.now() > item.expiresAt) {
        return null;
      }

      return item.value;
    } catch {
      return null;
    }
  }

  /**
   * Check if localStorage is available
   */
  isAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a value from storage
   * @param key - The storage key
   * @param defaultValue - Default value if key doesn't exist or is expired
   */
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string): T | null;
  get<T>(key: string, defaultValue?: T): T | null {
    if (!this.isAvailable()) {
      return defaultValue ?? null;
    }

    try {
      const fullKey = this.getFullKey(key);
      const data = localStorage.getItem(fullKey);

      if (!data) {
        return defaultValue ?? null;
      }

      const item = JSON.parse(data) as StorageItem<T>;

      // Check expiry
      if (item.expiresAt && Date.now() > item.expiresAt) {
        // Remove expired item
        this.remove(key);
        return defaultValue ?? null;
      }

      return item.value;
    } catch (error) {
      console.error(`StorageService: Failed to get key "${key}":`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Set a value in storage
   * @param key - The storage key
   * @param value - The value to store
   * @param options - Optional settings like TTL
   */
  set<T>(key: string, value: T, options?: SetOptions): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key);

      const item: StorageItem<T> = {
        value,
      };

      // Add expiry if TTL provided
      if (options?.ttl) {
        item.expiresAt = Date.now() + options.ttl;
      }

      const json = JSON.stringify(item);
      localStorage.setItem(fullKey, json);

      return true;
    } catch (error) {
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('StorageService: Storage quota exceeded');
      } else {
        console.error(`StorageService: Failed to set key "${key}":`, error);
      }
      return false;
    }
  }

  /**
   * Remove a value from storage
   * @param key - The storage key
   */
  remove(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key);
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.error(`StorageService: Failed to remove key "${key}":`, error);
      return false;
    }
  }

  /**
   * Check if a key exists (and is not expired)
   * @param key - The storage key
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get all keys (with this service's prefix)
   */
  keys(): string[] {
    if (!this.isAvailable()) {
      return [];
    }

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length));
      }
    }
    return keys;
  }

  /**
   * Clear all values (with this service's prefix only)
   */
  clear(): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const keysToRemove = this.keys();
      keysToRemove.forEach((key) => this.remove(key));
      return true;
    } catch (error) {
      console.error('StorageService: Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Get the size of stored data in bytes (approximate)
   */
  getSize(): number {
    if (!this.isAvailable()) {
      return 0;
    }

    let size = 0;
    this.keys().forEach((key) => {
      const fullKey = this.getFullKey(key);
      const value = localStorage.getItem(fullKey);
      if (value) {
        // Approximate size in bytes (2 bytes per character in JS)
        size += (fullKey.length + value.length) * 2;
      }
    });
    return size;
  }

  /**
   * Subscribe to changes on a key (for cross-tab sync)
   * @param key - The storage key to watch
   * @param listener - Callback when value changes
   * @returns Unsubscribe function
   */
  subscribe<T>(key: string, listener: StorageListener<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    const listeners = this.listeners.get(key)!;
    listeners.add(listener as StorageListener<unknown>);

    // Return unsubscribe function
    return () => {
      listeners.delete(listener as StorageListener<unknown>);
      if (listeners.size === 0) {
        this.listeners.delete(key);
      }
    };
  }
}

// ============================================
// Default Instance
// ============================================

/**
 * Default storage service instance with 'vexora' prefix
 * Use this for all app storage operations
 */
export const storage = new StorageService('vexora');

// ============================================
// Convenience Functions
// ============================================

/**
 * Type-safe storage key constants
 * Use these instead of raw strings for type safety
 */
export const STORAGE_KEYS = {
  CONVERSATIONS: 'conversations',
  ACTIVE_CONVERSATION_ID: 'active-conversation',
  SETTINGS: 'settings',
  THEME: 'theme',
  MODEL_CONFIG: 'model-config',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
