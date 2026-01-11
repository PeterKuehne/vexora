/**
 * Storage Quota Management
 *
 * Monitors LocalStorage usage and provides warnings/cleanup suggestions
 * when storage quota is approaching limits.
 */

import { storage } from './storage';

// ============================================
// Constants
// ============================================

/** LocalStorage typical limit in most browsers (5-10MB) */
export const STORAGE_LIMIT_MB = 5;

/** Warning threshold in MB (80% of limit) */
export const WARNING_THRESHOLD_MB = 4;

/** Critical threshold in MB (90% of limit) */
export const CRITICAL_THRESHOLD_MB = 4.5;

/** Bytes per MB */
const BYTES_PER_MB = 1024 * 1024;

// ============================================
// Types
// ============================================

/**
 * Storage usage information
 */
export interface StorageUsage {
  /** Total used bytes */
  usedBytes: number;
  /** Used space in MB */
  usedMB: number;
  /** Estimated available bytes (based on typical 5MB limit) */
  availableBytes: number;
  /** Available space in MB */
  availableMB: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Whether usage is above warning threshold */
  isWarning: boolean;
  /** Whether usage is above critical threshold */
  isCritical: boolean;
}

/**
 * Storage cleanup suggestion
 */
export interface CleanupSuggestion {
  /** Type of cleanup */
  type: 'old-conversations' | 'large-conversations' | 'expired-cache' | 'settings-reset';
  /** Description of what will be cleaned */
  description: string;
  /** Estimated bytes that can be freed */
  estimatedSavingsBytes: number;
  /** Estimated MB that can be freed */
  estimatedSavingsMB: number;
  /** Cleanup function */
  cleanup: () => Promise<boolean>;
}

/**
 * Detailed storage breakdown by category
 */
export interface StorageBreakdown {
  /** Conversations data size */
  conversations: {
    bytes: number;
    mb: number;
    count: number;
  };
  /** Settings data size */
  settings: {
    bytes: number;
    mb: number;
  };
  /** Other/unknown data size */
  other: {
    bytes: number;
    mb: number;
  };
  /** Total size */
  total: {
    bytes: number;
    mb: number;
  };
}

// ============================================
// Storage Usage Functions
// ============================================

/**
 * Get current storage usage information
 */
export function getStorageUsage(): StorageUsage {
  const usedBytes = storage.getSize();
  const usedMB = usedBytes / BYTES_PER_MB;
  const limitBytes = STORAGE_LIMIT_MB * BYTES_PER_MB;
  const availableBytes = Math.max(0, limitBytes - usedBytes);
  const availableMB = availableBytes / BYTES_PER_MB;
  const usagePercent = (usedBytes / limitBytes) * 100;

  return {
    usedBytes,
    usedMB: Math.round(usedMB * 100) / 100, // Round to 2 decimals
    availableBytes,
    availableMB: Math.round(availableMB * 100) / 100,
    usagePercent: Math.round(usagePercent * 10) / 10, // Round to 1 decimal
    isWarning: usedMB >= WARNING_THRESHOLD_MB,
    isCritical: usedMB >= CRITICAL_THRESHOLD_MB,
  };
}

/**
 * Get detailed breakdown of storage usage by category
 */
export function getStorageBreakdown(): StorageBreakdown {
  const keys = storage.keys();
  let conversationsBytes = 0;
  let settingsBytes = 0;
  let otherBytes = 0;
  let conversationCount = 0;

  keys.forEach((key) => {
    const fullKey = `qwen-chat-${key}`;
    const value = localStorage.getItem(fullKey);
    if (!value) return;

    const size = (fullKey.length + value.length) * 2; // Approximate bytes

    if (key === 'conversations') {
      conversationsBytes += size;
      try {
        const conversations = JSON.parse(value);
        conversationCount = Array.isArray(conversations?.value) ? conversations.value.length : 0;
      } catch {
        // Ignore parsing errors
      }
    } else if (key === 'settings' || key === 'theme' || key === 'model-config') {
      settingsBytes += size;
    } else {
      otherBytes += size;
    }
  });

  const totalBytes = conversationsBytes + settingsBytes + otherBytes;

  return {
    conversations: {
      bytes: conversationsBytes,
      mb: Math.round((conversationsBytes / BYTES_PER_MB) * 100) / 100,
      count: conversationCount,
    },
    settings: {
      bytes: settingsBytes,
      mb: Math.round((settingsBytes / BYTES_PER_MB) * 100) / 100,
    },
    other: {
      bytes: otherBytes,
      mb: Math.round((otherBytes / BYTES_PER_MB) * 100) / 100,
    },
    total: {
      bytes: totalBytes,
      mb: Math.round((totalBytes / BYTES_PER_MB) * 100) / 100,
    },
  };
}

/**
 * Check if storage quota is approaching limits
 */
export function checkStorageQuota(): {
  needsWarning: boolean;
  needsCriticalWarning: boolean;
  usage: StorageUsage;
  message: string;
} {
  const usage = getStorageUsage();

  if (usage.isCritical) {
    return {
      needsWarning: false,
      needsCriticalWarning: true,
      usage,
      message: `Kritisch: Speicher fast voll (${usage.usedMB} MB / ${STORAGE_LIMIT_MB} MB). Bitte Daten löschen um weitere Funktionalität sicherzustellen.`,
    };
  }

  if (usage.isWarning) {
    return {
      needsWarning: true,
      needsCriticalWarning: false,
      usage,
      message: `Warnung: Speicher wird knapp (${usage.usedMB} MB / ${STORAGE_LIMIT_MB} MB). Erwägen Sie das Löschen alter Unterhaltungen.`,
    };
  }

  return {
    needsWarning: false,
    needsCriticalWarning: false,
    usage,
    message: `Speicher OK (${usage.usedMB} MB / ${STORAGE_LIMIT_MB} MB verfügbar)`,
  };
}

// ============================================
// Cleanup Suggestions
// ============================================

/**
 * Get cleanup suggestions based on current storage usage
 */
export async function getCleanupSuggestions(): Promise<CleanupSuggestion[]> {
  const suggestions: CleanupSuggestion[] = [];
  const breakdown = getStorageBreakdown();

  // Import conversation storage dynamically to avoid circular dependencies
  const { conversationStorage } = await import('./conversationStorage');

  // Suggest removing old conversations if there are many
  if (breakdown.conversations.count > 50) {
    const oldConversationsSavings = breakdown.conversations.bytes * 0.3; // Estimate 30% savings
    suggestions.push({
      type: 'old-conversations',
      description: `Lösche alte Unterhaltungen (${Math.max(0, breakdown.conversations.count - 50)} von ${breakdown.conversations.count})`,
      estimatedSavingsBytes: oldConversationsSavings,
      estimatedSavingsMB: Math.round((oldConversationsSavings / BYTES_PER_MB) * 100) / 100,
      cleanup: async () => {
        try {
          const conversations = conversationStorage.getAllConversations();
          const sortedByDate = conversations.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

          // Keep only the 50 newest conversations
          const toDelete = sortedByDate.slice(50);
          let deletedCount = 0;

          for (const conversation of toDelete) {
            if (conversationStorage.deleteConversation(conversation.id)) {
              deletedCount++;
            }
          }

          return deletedCount > 0;
        } catch (error) {
          console.error('Failed to cleanup old conversations:', error);
          return false;
        }
      },
    });
  }

  // Suggest removing large conversations if conversations take significant space
  if (breakdown.conversations.mb > 1 && breakdown.conversations.count > 10) {
    const largeConversationsSavings = breakdown.conversations.bytes * 0.2; // Estimate 20% savings
    suggestions.push({
      type: 'large-conversations',
      description: `Lösche sehr große Unterhaltungen mit vielen Nachrichten`,
      estimatedSavingsBytes: largeConversationsSavings,
      estimatedSavingsMB: Math.round((largeConversationsSavings / BYTES_PER_MB) * 100) / 100,
      cleanup: async () => {
        try {
          const conversations = conversationStorage.getAllConversations();
          // Find conversations with >100 messages (estimate)
          const largeConversations = conversations.filter(conv => conv.messages.length > 100);

          let deletedCount = 0;
          for (const conversation of largeConversations.slice(0, 5)) { // Delete max 5 large ones
            if (conversationStorage.deleteConversation(conversation.id)) {
              deletedCount++;
            }
          }

          return deletedCount > 0;
        } catch (error) {
          console.error('Failed to cleanup large conversations:', error);
          return false;
        }
      },
    });
  }

  // Always offer settings reset as last resort
  if (breakdown.total.mb > WARNING_THRESHOLD_MB) {
    suggestions.push({
      type: 'settings-reset',
      description: 'Alle Einstellungen auf Standard zurücksetzen',
      estimatedSavingsBytes: breakdown.settings.bytes,
      estimatedSavingsMB: breakdown.settings.mb,
      cleanup: async () => {
        try {
          const { settingsStorage } = await import('./settingsStorage');
          return settingsStorage.resetSettings();
        } catch (error) {
          console.error('Failed to reset settings:', error);
          return false;
        }
      },
    });
  }

  return suggestions;
}

/**
 * Perform automatic cleanup based on priority
 */
export async function performAutomaticCleanup(): Promise<{
  success: boolean;
  cleanedBytes: number;
  cleanedMB: number;
  actions: string[];
}> {
  const actions: string[] = [];
  let totalCleaned = 0;

  try {
    const suggestions = await getCleanupSuggestions();

    // Try cleanup suggestions in order of safety (old conversations first)
    for (const suggestion of suggestions) {
      if (suggestion.type === 'old-conversations' || suggestion.type === 'large-conversations') {
        const beforeUsage = getStorageUsage();
        const success = await suggestion.cleanup();

        if (success) {
          const afterUsage = getStorageUsage();
          const cleaned = beforeUsage.usedBytes - afterUsage.usedBytes;
          totalCleaned += cleaned;
          actions.push(suggestion.description);

          // Stop if we've freed enough space
          if (afterUsage.usedMB < WARNING_THRESHOLD_MB) {
            break;
          }
        }
      }
    }

    return {
      success: actions.length > 0,
      cleanedBytes: totalCleaned,
      cleanedMB: Math.round((totalCleaned / BYTES_PER_MB) * 100) / 100,
      actions,
    };
  } catch (error) {
    console.error('Automatic cleanup failed:', error);
    return {
      success: false,
      cleanedBytes: 0,
      cleanedMB: 0,
      actions: [],
    };
  }
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Format storage usage as percentage bar
 */
export function formatUsageBar(usage: StorageUsage, width = 20): string {
  const filledChars = Math.round((usage.usagePercent / 100) * width);
  const emptyChars = width - filledChars;

  const filled = '█'.repeat(filledChars);
  const empty = '░'.repeat(emptyChars);

  return `${filled}${empty} ${usage.usagePercent}%`;
}