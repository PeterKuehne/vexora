/**
 * StorageQuotaDisplay - User Storage Quota Display Component
 *
 * Features:
 * - Sleek progress bar with gradient fill
 * - Role-based quota limits display
 * - Warning/Critical status indicators
 * - Real-time quota updates
 * - MANDATORY TailwindCSS with theme support
 * - Refined compact design
 */

import { useEffect, useState, useCallback } from 'react';
import { HardDrive, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
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
        color: isDark ? 'text-red-400' : 'text-red-500',
        bgColor: isDark ? 'bg-red-500/10' : 'bg-red-50',
        ringColor: isDark ? 'ring-red-500/20' : 'ring-red-200/60',
        label: 'Überschritten'
      };
    }

    if (usage.isCritical) {
      return {
        icon: AlertTriangle,
        color: isDark ? 'text-amber-400' : 'text-amber-500',
        bgColor: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
        ringColor: isDark ? 'ring-amber-500/20' : 'ring-amber-200/60',
        label: 'Kritisch'
      };
    }

    if (usage.isWarning) {
      return {
        icon: AlertTriangle,
        color: isDark ? 'text-yellow-400' : 'text-yellow-600',
        bgColor: isDark ? 'bg-yellow-500/10' : 'bg-yellow-50',
        ringColor: isDark ? 'ring-yellow-500/20' : 'ring-yellow-200/60',
        label: 'Warnung'
      };
    }

    return {
      icon: CheckCircle,
      color: isDark ? 'text-emerald-400' : 'text-emerald-500',
      bgColor: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
      ringColor: isDark ? 'ring-emerald-500/20' : 'ring-emerald-200/60',
      label: 'Normal'
    };
  };

  /**
   * Get progress bar gradient based on usage
   */
  const getProgressBarGradient = (usage: UserQuotaUsage) => {
    if (usage.isExceeded) {
      return 'bg-gradient-to-r from-red-500 to-red-400';
    }
    if (usage.isCritical) {
      return 'bg-gradient-to-r from-amber-500 to-orange-400';
    }
    if (usage.isWarning) {
      return 'bg-gradient-to-r from-yellow-500 to-amber-400';
    }
    return 'bg-gradient-to-r from-blue-500 to-blue-400';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`
        w-full p-4 rounded-xl transition-colors duration-150
        ${isDark
          ? 'bg-white/[0.03] border border-white/[0.06]'
          : 'bg-white border border-gray-200/80 shadow-sm'
        }
        ${className}
      `}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <HardDrive className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
          <div className="flex-1">
            <div className={`
              h-2 rounded-full animate-pulse
              ${isDark ? 'bg-white/5' : 'bg-gray-200'}
            `} />
          </div>
          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
            Laden...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`
        w-full p-4 rounded-xl transition-colors duration-150
        ${isDark
          ? 'bg-red-500/5 border border-red-500/15 text-red-400'
          : 'bg-red-50 border border-red-200/60 text-red-600'
        }
        ${className}
      `}>
        <div className="flex items-center gap-3">
          <XCircle className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Quota nicht verfügbar</p>
            <p className="text-xs opacity-70 truncate">{error}</p>
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
  const progressGradient = getProgressBarGradient(quotaUsage);

  return (
    <div className={`
      w-full p-4 rounded-xl transition-colors duration-150
      ${isDark
        ? 'bg-white/[0.03] border border-white/[0.06]'
        : 'bg-white border border-gray-200/80 shadow-sm'
      }
      ${className}
    `}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <HardDrive className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
          <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Speicher
          </span>
          <span className={`
            text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md ring-1
            ${statusIndicator.color} ${statusIndicator.bgColor} ${statusIndicator.ringColor}
          `}>
            {quotaUsage.userRole}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className={`
            flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium
            ${statusIndicator.bgColor} ${statusIndicator.color}
          `}>
            <StatusIcon className="w-3 h-3" />
            <span>{statusIndicator.label}</span>
          </div>
          <button
            onClick={loadQuotaUsage}
            disabled={isLoading}
            className={`
              p-1 rounded-md transition-colors duration-150
              ${isDark
                ? 'text-gray-600 hover:text-gray-400 hover:bg-white/5'
                : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title="Aktualisieren"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className={`
          w-full h-1.5 rounded-full overflow-hidden
          ${isDark ? 'bg-white/5' : 'bg-gray-100'}
        `}>
          <div
            className={`
              h-full rounded-full animate-bar-fill
              ${progressGradient}
            `}
            style={{
              width: `${Math.min(quotaUsage.usagePercent, 100)}%`
            }}
          />
        </div>
      </div>

      {/* Usage text */}
      <div className={`
        flex justify-between text-[11px] tabular-nums
        ${isDark ? 'text-gray-500' : 'text-gray-400'}
      `}>
        <span>{formatBytes(quotaUsage.usedBytes)} verwendet</span>
        <span>
          {quotaUsage.userRole === 'admin'
            ? `${quotaUsage.usagePercent.toFixed(1)}%`
            : `${formatBytes(quotaUsage.limitBytes)} Limit`
          }
        </span>
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className={`
          grid grid-cols-2 gap-4 pt-3 mt-3 border-t text-xs
          ${isDark
            ? 'border-white/[0.06] text-gray-400'
            : 'border-gray-100 text-gray-500'
          }
        `}>
          <div>
            <span className={`block text-[10px] font-medium uppercase tracking-wider mb-0.5 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
              Verwendet
            </span>
            <span className="tabular-nums">{quotaUsage.usedMB.toFixed(1)} MB</span>
          </div>
          <div>
            <span className={`block text-[10px] font-medium uppercase tracking-wider mb-0.5 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
              Verfügbar
            </span>
            <span className="tabular-nums">
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
          mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed
          ${isDark
            ? quotaUsage.isExceeded
              ? 'bg-red-500/5 border border-red-500/15 text-red-400'
              : quotaUsage.isCritical
              ? 'bg-amber-500/5 border border-amber-500/15 text-amber-400'
              : 'bg-yellow-500/5 border border-yellow-500/15 text-yellow-400'
            : quotaUsage.isExceeded
              ? 'bg-red-50 border border-red-100 text-red-600'
              : quotaUsage.isCritical
              ? 'bg-amber-50 border border-amber-100 text-amber-600'
              : 'bg-yellow-50 border border-yellow-100 text-yellow-700'
          }
        `}>
          {quotaUsage.isExceeded && (
            <span><strong>Quota überschritten</strong> — Keine weiteren Uploads möglich.</span>
          )}
          {quotaUsage.isCritical && !quotaUsage.isExceeded && (
            <span><strong>Fast voll</strong> — Nur noch {quotaUsage.availableMB.toFixed(1)} MB frei.</span>
          )}
          {quotaUsage.isWarning && !quotaUsage.isCritical && (
            <span><strong>Speicher wird knapp</strong> — {quotaUsage.availableMB.toFixed(1)} MB verfügbar.</span>
          )}
        </div>
      )}
    </div>
  );
}
