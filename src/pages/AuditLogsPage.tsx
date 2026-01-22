/**
 * Audit Logs Page
 * Allows administrators to view system audit logs and user activity
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import type { AuditLogEntry } from '../types/auth';
import { fetchAuditLogs } from '../lib/api';

export function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [statistics, setStatistics] = useState({
    totalLogs: 0,
    successCount: 0,
    failureCount: 0,
    deniedCount: 0,
    topActions: [] as Array<{ action: string; count: number }>
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({
    result: 'all' as 'all' | 'success' | 'failure' | 'denied',
    action: 'all' as string,
    daysBack: 90
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    hasMore: true
  });

  const { } = useAuth(); // Auth context for potential future use
  const { theme } = useTheme();
  const { addToast } = useToast();
  const isDark = theme === 'dark';

  // Load audit logs on component mount and when filters change
  useEffect(() => {
    loadAuditLogs();
  }, [filter, pagination.offset]);

  const loadAuditLogs = async (append = false) => {
    try {
      if (!append) {
        setIsLoading(true);
      }

      const response = await fetchAuditLogs(
        pagination.limit,
        append ? pagination.offset : 0,
        filter.daysBack
      );

      let filteredLogs = response.data.auditLogs;

      // Apply result filter
      if (filter.result !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.result === filter.result);
      }

      // Apply action filter
      if (filter.action !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.action === filter.action);
      }

      if (append) {
        setAuditLogs(prevLogs => [...prevLogs, ...filteredLogs]);
      } else {
        setAuditLogs(filteredLogs);
        setStatistics(response.data.statistics);
      }

      setPagination(prev => ({
        ...prev,
        hasMore: response.data.pagination.returned === pagination.limit
      }));

    } catch (error) {
      console.error('Error loading audit logs:', error);
      addToast('error', error instanceof Error ? error.message : 'Failed to load audit logs');
    } finally {
      if (!append) {
        setIsLoading(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatAction = (action: string) => {
    const actionMap: Record<string, string> = {
      'login': 'Login',
      'logout': 'Logout',
      'user_update': 'Benutzer-Update',
      'document_upload': 'Dokument-Upload',
      'document_delete': 'Dokument-Löschen',
      'rag_query': 'RAG-Query',
      'permission_change': 'Berechtigungs-Änderung'
    };
    return actionMap[action] || action;
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'success':
        return (
          <span className={`
            inline-flex px-2 py-1 text-xs font-semibold rounded-full
            transition-colors duration-150
            ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'}
          `}>
            ✓ Erfolgreich
          </span>
        );
      case 'failure':
        return (
          <span className={`
            inline-flex px-2 py-1 text-xs font-semibold rounded-full
            transition-colors duration-150
            ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'}
          `}>
            ✗ Fehlgeschlagen
          </span>
        );
      case 'denied':
        return (
          <span className={`
            inline-flex px-2 py-1 text-xs font-semibold rounded-full
            transition-colors duration-150
            ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-800'}
          `}>
            🚫 Verweigert
          </span>
        );
      default:
        return (
          <span className={`
            inline-flex px-2 py-1 text-xs font-semibold rounded-full
            transition-colors duration-150
            ${isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'}
          `}>
            {result}
          </span>
        );
    }
  };

  const loadMore = () => {
    if (pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
      loadAuditLogs(true);
    }
  };

  if (isLoading) {
    return (
      <div className={`
        min-h-screen flex items-center justify-center
        transition-colors duration-150
        ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
      `}>
        <div className={`
          flex items-center space-x-3
          px-6 py-4 rounded-lg
          transition-colors duration-150
          ${isDark
            ? 'text-gray-300 bg-gray-800/50'
            : 'text-gray-600 bg-white/50'
          }
        `}>
          <div className={`
            w-5 h-5 border-2 border-t-transparent rounded-full animate-spin
            transition-colors duration-150
            ${isDark ? 'border-gray-400' : 'border-gray-500'}
          `} />
          <span className="text-sm font-medium">Lade Audit-Logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      min-h-screen
      transition-colors duration-150
      ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
    `}>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className={`
            text-3xl font-bold
            transition-colors duration-150
            ${isDark ? 'text-white' : 'text-gray-900'}
          `}>
            Audit-Logs
          </h1>
          <p className={`
            mt-2 text-sm
            transition-colors duration-150
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}>
            Systemaktivitäten und Benutzeraktionen der letzten {filter.daysBack} Tage
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-blue-400' : 'text-blue-600'}
            `}>
              {statistics.totalLogs}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Gesamt
            </div>
          </div>

          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-green-400' : 'text-green-600'}
            `}>
              {statistics.successCount}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Erfolgreich
            </div>
          </div>

          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-red-400' : 'text-red-600'}
            `}>
              {statistics.failureCount}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Fehlgeschlagen
            </div>
          </div>

          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-orange-400' : 'text-orange-600'}
            `}>
              {statistics.deniedCount}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Verweigert
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`
          mb-6 p-6 rounded-lg border
          transition-colors duration-150
          ${isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
          }
        `}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Result Filter */}
            <div>
              <label className={`
                block text-sm font-medium mb-2
                transition-colors duration-150
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}>
                Ergebnis
              </label>
              <select
                value={filter.result}
                onChange={(e) => setFilter(prev => ({ ...prev, result: e.target.value as any }))}
                className={`
                  w-full px-3 py-2 text-sm rounded border
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                `}
              >
                <option value="all">Alle Ergebnisse</option>
                <option value="success">Erfolgreich</option>
                <option value="failure">Fehlgeschlagen</option>
                <option value="denied">Verweigert</option>
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <label className={`
                block text-sm font-medium mb-2
                transition-colors duration-150
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}>
                Aktion
              </label>
              <select
                value={filter.action}
                onChange={(e) => setFilter(prev => ({ ...prev, action: e.target.value }))}
                className={`
                  w-full px-3 py-2 text-sm rounded border
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                `}
              >
                <option value="all">Alle Aktionen</option>
                {statistics.topActions.map(({ action }) => (
                  <option key={action} value={action}>{formatAction(action)}</option>
                ))}
              </select>
            </div>

            {/* Days Back Filter */}
            <div>
              <label className={`
                block text-sm font-medium mb-2
                transition-colors duration-150
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}>
                Zeitraum
              </label>
              <select
                value={filter.daysBack}
                onChange={(e) => setFilter(prev => ({ ...prev, daysBack: parseInt(e.target.value) }))}
                className={`
                  w-full px-3 py-2 text-sm rounded border
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                `}
              >
                <option value={7}>Letzte 7 Tage</option>
                <option value={30}>Letzte 30 Tage</option>
                <option value={90}>Letzte 90 Tage</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className={`
          rounded-lg border overflow-hidden
          transition-colors duration-150
          ${isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
          }
        `}>
          <div className={`
            px-6 py-4 border-b
            transition-colors duration-150
            ${isDark ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <h2 className={`
              text-lg font-semibold
              transition-colors duration-150
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              Audit-Logs ({auditLogs.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={`
                transition-colors duration-150
                ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}
              `}>
                <tr>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Zeitstempel
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Benutzer
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Aktion
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Ressource
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Ergebnis
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    IP-Adresse
                  </th>
                </tr>
              </thead>
              <tbody className={`
                divide-y
                transition-colors duration-150
                ${isDark ? 'divide-gray-700' : 'divide-gray-200'}
              `}>
                {auditLogs.map((log) => (
                  <tr key={log.id} className={`
                    transition-colors duration-150
                    ${isDark
                      ? 'hover:bg-gray-700/50'
                      : 'hover:bg-gray-50'
                    }
                  `}>
                    <td className={`
                      px-6 py-4 whitespace-nowrap text-sm
                      transition-colors duration-150
                      ${isDark ? 'text-gray-300' : 'text-gray-600'}
                    `}>
                      {formatDate(log.created_at)}
                    </td>
                    <td className={`
                      px-6 py-4 whitespace-nowrap text-sm font-medium
                      transition-colors duration-150
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      {log.user_email}
                    </td>
                    <td className={`
                      px-6 py-4 whitespace-nowrap text-sm
                      transition-colors duration-150
                      ${isDark ? 'text-gray-300' : 'text-gray-600'}
                    `}>
                      {formatAction(log.action)}
                    </td>
                    <td className={`
                      px-6 py-4 whitespace-nowrap text-sm
                      transition-colors duration-150
                      ${isDark ? 'text-gray-300' : 'text-gray-600'}
                    `}>
                      {log.resource_type ? `${log.resource_type}${log.resource_id ? ` (${log.resource_id.substring(0, 8)}...)` : ''}` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getResultBadge(log.result)}
                    </td>
                    <td className={`
                      px-6 py-4 whitespace-nowrap text-sm
                      transition-colors duration-150
                      ${isDark ? 'text-gray-300' : 'text-gray-600'}
                    `}>
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More Button */}
          {pagination.hasMore && (
            <div className={`
              px-6 py-4 border-t
              transition-colors duration-150
              ${isDark ? 'border-gray-700' : 'border-gray-200'}
            `}>
              <button
                onClick={loadMore}
                className={`
                  w-full px-4 py-2 rounded text-sm font-medium
                  transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                Weitere Logs laden
              </button>
            </div>
          )}
        </div>

        {/* Top Actions Summary */}
        {statistics.topActions.length > 0 && (
          <div className={`
            mt-8 p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            <h3 className={`
              text-lg font-semibold mb-4
              transition-colors duration-150
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              Häufigste Aktionen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {statistics.topActions.map(({ action, count }) => (
                <div key={action} className={`
                  p-4 rounded border
                  transition-colors duration-150
                  ${isDark
                    ? 'bg-gray-700/50 border-gray-600'
                    : 'bg-gray-50 border-gray-200'
                  }
                `}>
                  <div className={`
                    text-xl font-bold
                    transition-colors duration-150
                    ${isDark ? 'text-blue-400' : 'text-blue-600'}
                  `}>
                    {count}
                  </div>
                  <div className={`
                    text-sm
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-600'}
                  `}>
                    {formatAction(action)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}