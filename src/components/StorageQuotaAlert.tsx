/**
 * Storage Quota Alert Component
 *
 * Shows warnings when LocalStorage is approaching limits and provides
 * cleanup suggestions.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  HardDrive,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getStorageUsage,
  getStorageBreakdown,
  getCleanupSuggestions,
  checkStorageQuota,
  formatBytes,
  formatUsageBar,
  type StorageUsage,
  type StorageBreakdown,
  type CleanupSuggestion,
} from '../lib/storageQuota';

// ============================================
// Types
// ============================================

export interface StorageQuotaAlertProps {
  /** Whether to show the alert */
  show?: boolean;
  /** Called when alert is dismissed */
  onDismiss?: () => void;
  /** Minimum threshold to show warning (default: 4MB) */
  warningThreshold?: number;
  /** Whether to show detailed breakdown */
  showDetails?: boolean;
}

// ============================================
// Main Component
// ============================================

export function StorageQuotaAlert({
  show: forceShow = false,
  onDismiss,
  warningThreshold = 4,
  showDetails = false,
}: StorageQuotaAlertProps): React.JSX.Element | null {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Update usage info
  const updateUsage = () => {
    setUsage(getStorageUsage());
    if (showDetails || isExpanded) {
      setBreakdown(getStorageBreakdown());
    }
  };

  // Load cleanup suggestions
  const loadSuggestions = async () => {
    try {
      const newSuggestions = await getCleanupSuggestions();
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Failed to load cleanup suggestions:', error);
    }
  };

  useEffect(() => {
    updateUsage();
    if (isExpanded) {
      loadSuggestions();
    }
  }, [isExpanded, showDetails]);

  // Perform cleanup action
  const handleCleanup = async (suggestion: CleanupSuggestion) => {
    setIsLoading(true);
    try {
      const success = await suggestion.cleanup();
      if (success) {
        updateUsage();
        await loadSuggestions();
        // Show success feedback (you could use a toast here)
        console.log(`Cleanup completed: ${suggestion.description}`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Determine if we should show the alert
  const shouldShow = forceShow || (usage && (usage.usedMB >= warningThreshold));

  if (!shouldShow || !usage || isDismissed) {
    return null;
  }

  const quotaCheck = checkStorageQuota();
  const isWarning = quotaCheck.needsWarning;
  const isCritical = quotaCheck.needsCriticalWarning;

  return (
    <div className={`rounded-lg border p-4 ${
      isCritical
        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={`mt-0.5 ${
            isCritical ? 'text-red-500' : 'text-yellow-500'
          }`}>
            {isCritical ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1">
            <h3 className={`font-medium ${
              isCritical
                ? 'text-red-800 dark:text-red-200'
                : 'text-yellow-800 dark:text-yellow-200'
            }`}>
              {isCritical ? 'Speicher kritisch voll' : 'Speicher wird knapp'}
            </h3>

            <p className={`mt-1 text-sm ${
              isCritical
                ? 'text-red-600 dark:text-red-300'
                : 'text-yellow-600 dark:text-yellow-300'
            }`}>
              {quotaCheck.message}
            </p>

            {/* Usage Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Speicher Verwendung</span>
                <span>{usage.usedMB} MB / 5 MB</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    isCritical
                      ? 'bg-red-500'
                      : isWarning
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(usage.usagePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Details Toggle */}
      <div className="mt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
            isCritical
              ? 'text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200'
              : 'text-yellow-700 hover:text-yellow-800 dark:text-yellow-300 dark:hover:text-yellow-200'
          }`}
        >
          <span>Details und Lösungsvorschläge anzeigen</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 space-y-4">

            {/* Storage Breakdown */}
            {breakdown && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Speicher Aufteilung
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Unterhaltungen:</span>
                      <span className="font-mono">{formatBytes(breakdown.conversations.bytes)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500">
                      <span></span>
                      <span>{breakdown.conversations.count} Unterhaltungen</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Einstellungen:</span>
                      <span className="font-mono">{formatBytes(breakdown.settings.bytes)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cleanup Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Aufräum-Vorschläge
                </h4>
                <div className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center space-x-3">
                        <Trash2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {suggestion.description}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Spart ~{formatBytes(suggestion.estimatedSavingsBytes)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCleanup(suggestion)}
                        disabled={isLoading}
                        className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        {isLoading ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        <span>{isLoading ? 'Lösche...' : 'Löschen'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refresh Button */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={updateUsage}
                className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Speicher neu überprüfen</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Compact Variant
// ============================================

export function StorageQuotaAlertCompact({
  show: forceShow = false,
}: { show?: boolean }): React.JSX.Element | null {
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    setUsage(getStorageUsage());
  }, []);

  const shouldShow = forceShow || (usage && usage.isWarning);

  if (!shouldShow || !usage) {
    return null;
  }

  const isCritical = usage.isCritical;

  return (
    <div className={`flex items-center space-x-2 px-2 py-1 rounded text-xs ${
      isCritical
        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
    }`}>
      <HardDrive className="h-3 w-3" />
      <span>{usage.usedMB} / 5 MB</span>
      <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            isCritical ? 'bg-red-500' : 'bg-yellow-500'
          }`}
          style={{ width: `${Math.min(usage.usagePercent, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// Debug Variant
// ============================================

export function StorageQuotaDebug(): React.JSX.Element {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);

  useEffect(() => {
    setUsage(getStorageUsage());
    setBreakdown(getStorageBreakdown());
  }, []);

  if (!usage || !breakdown) {
    return <div>Loading storage info...</div>;
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs font-mono space-y-2">
      <h3 className="font-bold text-sm">Storage Debug Info</h3>
      <div>
        <div>Used: {formatBytes(usage.usedBytes)} ({usage.usedMB} MB)</div>
        <div>Available: {formatBytes(usage.availableBytes)} ({usage.availableMB} MB)</div>
        <div>Usage: {usage.usagePercent}%</div>
        <div>Warning: {usage.isWarning ? 'Yes' : 'No'}</div>
        <div>Critical: {usage.isCritical ? 'Yes' : 'No'}</div>
      </div>
      <div>
        <div className="font-semibold">Breakdown:</div>
        <div>Conversations: {formatBytes(breakdown.conversations.bytes)} ({breakdown.conversations.count} items)</div>
        <div>Settings: {formatBytes(breakdown.settings.bytes)}</div>
        <div>Other: {formatBytes(breakdown.other.bytes)}</div>
      </div>
      <div className="text-xs text-gray-500">
        {formatUsageBar(usage, 30)}
      </div>
    </div>
  );
}