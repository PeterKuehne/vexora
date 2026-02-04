/**
 * StorageQuotaDisplay - User Storage Quota Display Component
 *
 * Features:
 * - Progress bar with usage visualization
 * - Role-based quota limits display
 * - Warning/Critical status indicators
 * - Real-time quota updates
 * - MANDATORY TailwindCSS with theme support
 */

import { useEffect, useState, useCallback } from 'react';
import { HardDrive, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getQuotaUsage, type UserQuotaUsage, formatBytes } from '../lib/api';

export interface StorageQuotaDisplayProps {
  /** Optional className for customization */
  className?: string;
  /** Whether to show detailed stats */
  showDetails?: boolean;
  /** Callback when quota data is loaded */
  onQuotaLoaded?: (usage: UserQuotaUsage) => void;
}

export function StorageQuotaDisplay({
  className = '',
  showDetails = true,
  onQuotaLoaded
}: StorageQuotaDisplayProps) {
  const { isDark } = useTheme();
  const [quotaUsage, setQuotaUsage] = useState<UserQuotaUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load quota usage data
   */
  const loadQuotaUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const usage = await getQuotaUsage();
      setQuotaUsage(usage);
      onQuotaLoaded?.(usage);
    } catch (err) {
      console.error('Failed to load quota usage:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quota information');
    } finally {
      setIsLoading(false);
    }
  }, [onQuotaLoaded]);

  // Load quota on mount (only once)
  useEffect(() => {
    loadQuotaUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  /**
   * Get status indicator based on usage
   */
  const getStatusIndicator = (usage: UserQuotaUsage) => {
    if (usage.isExceeded) {
      return {
        icon: XCircle,
        color: isDark ? 'text-red-400' : 'text-red-600',
        bgColor: isDark ? 'bg-red-900/20' : 'bg-red-100',
        label: 'Quota überschritten'
      };
    }

    if (usage.isCritical) {
      return {
        icon: AlertTriangle,
        color: isDark ? 'text-orange-400' : 'text-orange-600',
        bgColor: isDark ? 'bg-orange-900/20' : 'bg-orange-100',
        label: 'Kritisch'
      };
    }

    if (usage.isWarning) {
      return {
        icon: AlertTriangle,
        color: isDark ? 'text-yellow-400' : 'text-yellow-600',
        bgColor: isDark ? 'bg-yellow-900/20' : 'bg-yellow-100',
        label: 'Warnung'
      };
    }

    return {
      icon: CheckCircle,
      color: isDark ? 'text-green-400' : 'text-green-600',
      bgColor: isDark ? 'bg-green-900/20' : 'bg-green-100',
      label: 'Normal'
    };
  };

  /**
   * Get progress bar color based on usage
   */
  const getProgressBarColor = (usage: UserQuotaUsage) => {
    if (usage.isExceeded) {
      return isDark ? 'bg-red-500' : 'bg-red-600';
    }
    if (usage.isCritical) {
      return isDark ? 'bg-orange-500' : 'bg-orange-600';
    }
    if (usage.isWarning) {
      return isDark ? 'bg-yellow-500' : 'bg-yellow-600';
    }
    return isDark ? 'bg-blue-500' : 'bg-blue-600';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`
        w-full p-4 rounded-lg border transition-colors duration-150
        ${isDark
          ? 'bg-surface border-white/10'
          : 'bg-white border-gray-200'
        }
        ${className}
      `}>
        <div className={`
          flex items-center gap-3
          ${isDark ? 'text-gray-300' : 'text-gray-700'}
        `}>
          <HardDrive className="w-5 h-5" />
          <div className="flex-1">
            <div className={`
              h-4 rounded animate-pulse
              ${isDark ? 'bg-white/10' : 'bg-gray-300'}
            `} />
          </div>
        </div>
        <p className={`
          mt-2 text-sm
          ${isDark ? 'text-gray-400' : 'text-gray-500'}
        `}>
          Speicher-Quota wird geladen...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`
        w-full p-4 rounded-lg border transition-colors duration-150
        ${isDark
          ? 'bg-red-900/20 border-red-800 text-red-300'
          : 'bg-red-50 border-red-200 text-red-700'
        }
        ${className}
      `}>
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">Quota-Informationen nicht verfügbar</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!quotaUsage) {
    return null;
  }

  const statusIndicator = getStatusIndicator(quotaUsage);
  const StatusIcon = statusIndicator.icon;
  const progressBarColor = getProgressBarColor(quotaUsage);

  return (
    <div className={`
      w-full p-4 rounded-lg border transition-colors duration-150
      ${isDark
        ? 'bg-surface border-white/10'
        : 'bg-white border-gray-200'
      }
      ${className}
    `}>
      {/* Header with status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className={`
            w-5 h-5
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `} />
          <span className={`
            font-medium
            ${isDark ? 'text-gray-200' : 'text-gray-800'}
          `}>
            Speicher-Quota
          </span>
          <span className={`
            text-xs px-2 py-1 rounded-full font-medium uppercase tracking-wide
            ${statusIndicator.color} ${statusIndicator.bgColor}
          `}>
            {quotaUsage.userRole}
          </span>
        </div>

        <div className={`
          flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium
          ${statusIndicator.bgColor} ${statusIndicator.color}
        `}>
          <StatusIcon className="w-4 h-4" />
          <span>{statusIndicator.label}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className={`
          w-full h-3 rounded-full overflow-hidden
          ${isDark ? 'bg-white/10' : 'bg-gray-200'}
        `}>
          <div
            className={`
              h-full transition-all duration-500 ease-out
              ${progressBarColor}
            `}
            style={{
              width: `${Math.min(quotaUsage.usagePercent, 100)}%`
            }}
          />
        </div>

        {/* Usage Text */}
        <div className={`
          flex justify-between mt-2 text-sm
          ${isDark ? 'text-gray-300' : 'text-gray-600'}
        `}>
          <span>
            {formatBytes(quotaUsage.usedBytes)} verwendet
          </span>
          <span>
            {quotaUsage.userRole === 'admin'
              ? `${quotaUsage.usagePercent.toFixed(1)}%`
              : `${formatBytes(quotaUsage.limitBytes)} Limit`
            }
          </span>
        </div>
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className={`
          grid grid-cols-2 gap-4 pt-3 border-t text-sm
          ${isDark
            ? 'border-white/10 text-gray-300'
            : 'border-gray-200 text-gray-600'
          }
        `}>
          <div>
            <span className="block font-medium">Verwendet:</span>
            <span>{quotaUsage.usedMB.toFixed(1)} MB</span>
          </div>
          <div>
            <span className="block font-medium">Verfügbar:</span>
            <span>
              {quotaUsage.userRole === 'admin'
                ? 'Unbegrenzt'
                : `${quotaUsage.availableMB.toFixed(1)} MB`
              }
            </span>
          </div>
        </div>
      )}

      {/* Warning Message */}
      {(quotaUsage.isWarning || quotaUsage.isCritical || quotaUsage.isExceeded) && (
        <div className={`
          mt-3 p-3 rounded-md flex items-start gap-2 text-sm
          ${isDark
            ? quotaUsage.isExceeded
              ? 'bg-red-900/30 border border-red-800 text-red-300'
              : quotaUsage.isCritical
              ? 'bg-orange-900/30 border border-orange-800 text-orange-300'
              : 'bg-yellow-900/30 border border-yellow-800 text-yellow-300'
            : quotaUsage.isExceeded
              ? 'bg-red-50 border border-red-200 text-red-700'
              : quotaUsage.isCritical
              ? 'bg-orange-50 border border-orange-200 text-orange-700'
              : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
          }
        `}>
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {quotaUsage.isExceeded && (
              <p>
                <strong>Quota überschritten!</strong> Sie können keine weiteren Dokumente hochladen,
                bis Sie Speicherplatz freigeben.
              </p>
            )}
            {quotaUsage.isCritical && !quotaUsage.isExceeded && (
              <p>
                <strong>Speicher fast voll!</strong> Nur noch {quotaUsage.availableMB.toFixed(1)} MB verfügbar.
                Löschen Sie nicht benötigte Dokumente.
              </p>
            )}
            {quotaUsage.isWarning && !quotaUsage.isCritical && (
              <p>
                <strong>Speicher wird knapp.</strong> Sie haben {quotaUsage.availableMB.toFixed(1)} MB verfügbar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Refresh Button for Manual Updates */}
      <div className="flex justify-end mt-3">
        <button
          onClick={loadQuotaUsage}
          disabled={isLoading}
          className={`
            text-xs px-3 py-1 rounded transition-colors duration-150
            ${isDark
              ? 'text-gray-400 hover:text-gray-300 hover:bg-white/10'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? 'Aktualisieren...' : 'Aktualisieren'}
        </button>
      </div>
    </div>
  );
}