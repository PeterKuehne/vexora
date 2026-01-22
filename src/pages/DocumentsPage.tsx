/**
 * Documents Page - Complete Document Management Interface
 * Full-screen document management (NOT sidebar) with upload, list, and search
 * Follows MANDATORY TailwindCSS styling convention with theme support
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { useAuth } from '../contexts/AuthContext';
import { DocumentUploadWithPermissions } from '../components/DocumentUploadWithPermissions';
import { DocumentList } from '../components/DocumentList';
import { StorageQuotaDisplay } from '../components/StorageQuotaDisplay';
import { Search, Filter, Upload, FileText, TrendingUp, Users, Clock } from 'lucide-react';

export function DocumentsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { totalDocuments, documents } = useDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadArea, setShowUploadArea] = useState(false);

  // Calculate document statistics
  const documentStats = {
    total: totalDocuments,
    recent: documents.filter(doc => {
      const uploadDate = new Date(doc.uploadedAt);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return uploadDate > dayAgo;
    }).length,
    size: documents.reduce((total, doc) => total + (doc.size || 0), 0),
    types: new Set(documents.map(doc => doc.type)).size,
  };

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className={`
      min-h-screen
      transition-colors duration-150
      ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
    `}>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={`
                text-3xl font-bold
                transition-colors duration-150
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Dokumente
              </h1>
              <p className={`
                mt-2 text-sm
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                Verwalten Sie Ihre Dokumente mit Enterprise-Sicherheit und Berechtigungen
              </p>
            </div>

            <button
              onClick={() => setShowUploadArea(!showUploadArea)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg
                text-sm font-medium
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              <Upload size={18} />
              Dokument hochladen
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                transition-colors duration-150
                ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}
              `}>
                <FileText
                  size={20}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-blue-400' : 'text-blue-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-2xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-blue-400' : 'text-blue-600'}
                `}>
                  {documentStats.total}
                </div>
                <div className={`
                  text-sm font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Gesamt
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                transition-colors duration-150
                ${isDark ? 'bg-green-500/20' : 'bg-green-100'}
              `}>
                <Clock
                  size={20}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-green-400' : 'text-green-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-2xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-green-400' : 'text-green-600'}
                `}>
                  {documentStats.recent}
                </div>
                <div className={`
                  text-sm font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Letzte 24h
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                transition-colors duration-150
                ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}
              `}>
                <TrendingUp
                  size={20}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-purple-400' : 'text-purple-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-2xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-purple-400' : 'text-purple-600'}
                `}>
                  {formatFileSize(documentStats.size)}
                </div>
                <div className={`
                  text-sm font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Speicher
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                transition-colors duration-150
                ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}
              `}>
                <Users
                  size={20}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-orange-400' : 'text-orange-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-2xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-orange-400' : 'text-orange-600'}
                `}>
                  {user?.role === 'Admin' ? 'Alle' : user?.department || 'Eigene'}
                </div>
                <div className={`
                  text-sm font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Zugriff
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Quota Display */}
        <div className="mb-8">
          <StorageQuotaDisplay
            showDetails={true}
            onQuotaLoaded={(usage) => {
              // Could add quota data to context or state if needed
              console.log('User quota loaded:', usage);
            }}
          />
        </div>

        {/* Upload Area - Collapsible */}
        {showUploadArea && (
          <div className={`
            mb-8 p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className="mb-4">
              <h2 className={`
                text-lg font-semibold
                transition-colors duration-150
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Neues Dokument hochladen
              </h2>
              <p className={`
                text-sm mt-1
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                Laden Sie ein PDF-Dokument mit Berechtigungen und Klassifizierung hoch
              </p>
            </div>
            <DocumentUploadWithPermissions />
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className={`
          mb-6 p-4 rounded-lg border
          transition-colors duration-150
          ${isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
          }
        `}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search
                size={18}
                className={`
                  absolute left-3 top-1/2 transform -translate-y-1/2
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}
              />
              <input
                type="text"
                placeholder="Dokumente nach Namen durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`
                  w-full pl-10 pr-4 py-2 rounded-lg border
                  text-sm
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }
                `}
              />
            </div>
            <button className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border
              text-sm font-medium
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-gray-500
              ${isDark
                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }
            `}>
              <Filter size={16} />
              Filter
            </button>
          </div>
        </div>

        {/* Document List - Full Width */}
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
            <div className="flex items-center justify-between">
              <h2 className={`
                text-lg font-semibold
                transition-colors duration-150
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Ihre Dokumente
              </h2>
              <span className={`
                text-sm
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                {totalDocuments} {totalDocuments === 1 ? 'Dokument' : 'Dokumente'}
              </span>
            </div>
          </div>

          {/* Document List Component - Reuse existing component */}
          <div className="p-6">
            <DocumentList />
          </div>
        </div>

      </div>
    </div>
  );
}