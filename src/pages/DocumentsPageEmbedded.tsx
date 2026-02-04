/**
 * Documents Page Embedded - Document Management for Main Content Area
 * Embedded version of DocumentsPage for use within the chat layout
 * Follows MANDATORY TailwindCSS styling convention with theme support
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { useAuth } from '../contexts/AuthContext';
import { DocumentList } from '../components/DocumentList';
import { StorageQuotaDisplay } from '../components/StorageQuotaDisplay';
import { UploadModal } from '../components/UploadModal';
import { Search, Plus, FileText, TrendingUp, Users, Clock, X } from 'lucide-react';

export function DocumentsPageEmbedded() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { totalDocuments, documents } = useDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

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
      h-full overflow-auto
      transition-colors duration-150
      ${isDark ? 'bg-background' : 'bg-white'}
    `}>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">

        {/* Header Section - Compact */}
        <div className="mb-6">
          <h1 className={`
            text-2xl font-bold
            transition-colors duration-150
            ${isDark ? 'text-white' : 'text-gray-900'}
          `}>
            RAG Dokumente
          </h1>
          <p className={`
            mt-1 text-sm
            transition-colors duration-150
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}>
            Verwalten Sie Ihre Dokumente für die RAG-Suche
          </p>
        </div>

        {/* Statistics Cards - Compact version */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`
            p-4 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
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
                  size={18}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-blue-400' : 'text-blue-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-blue-400' : 'text-blue-600'}
                `}>
                  {documentStats.total}
                </div>
                <div className={`
                  text-xs font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Gesamt
                </div>
              </div>
            </div>
          </div>

          <div className={`
            p-4 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
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
                  size={18}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-green-400' : 'text-green-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-green-400' : 'text-green-600'}
                `}>
                  {documentStats.recent}
                </div>
                <div className={`
                  text-xs font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Letzte 24h
                </div>
              </div>
            </div>
          </div>

          <div className={`
            p-4 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
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
                  size={18}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-purple-400' : 'text-purple-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-purple-400' : 'text-purple-600'}
                `}>
                  {formatFileSize(documentStats.size)}
                </div>
                <div className={`
                  text-xs font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Speicher
                </div>
              </div>
            </div>
          </div>

          <div className={`
            p-4 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
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
                  size={18}
                  className={`
                    transition-colors duration-150
                    ${isDark ? 'text-orange-400' : 'text-orange-600'}
                  `}
                />
              </div>
              <div>
                <div className={`
                  text-xl font-bold
                  transition-colors duration-150
                  ${isDark ? 'text-orange-400' : 'text-orange-600'}
                `}>
                  {user?.role === 'Admin' ? 'Alle' : user?.department || 'Eigene'}
                </div>
                <div className={`
                  text-xs font-medium
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  Zugriff
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Quota Display - Compact */}
        <div className="mb-6">
          <StorageQuotaDisplay
            showDetails={false}
            onQuotaLoaded={(usage) => {
              console.log('User quota loaded:', usage);
            }}
          />
        </div>

        {/* Search Bar */}
        <div className={`
          mb-4 p-3 rounded-lg border
          transition-colors duration-150
          ${isDark
            ? 'bg-surface border-white/10'
            : 'bg-white border-gray-200'
          }
        `}>
          <div className="relative">
            <Search
              size={16}
              className={`
                absolute left-3 top-1/2 transform -translate-y-1/2
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-500'}
              `}
            />
            <input
              type="text"
              placeholder="Dokumente nach Name, Kategorie oder Tags durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`
                w-full pl-9 pr-10 py-2 rounded-lg border
                text-sm
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isDark
                  ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }
              `}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`
                  absolute right-3 top-1/2 transform -translate-y-1/2
                  p-0.5 rounded transition-colors
                  ${isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }
                `}
                title="Suche zurücksetzen"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Document List */}
        <div className={`
          rounded-lg border overflow-hidden
          transition-colors duration-150
          ${isDark
            ? 'bg-surface border-white/10'
            : 'bg-white border-gray-200'
          }
        `}>
          <div className={`
            px-4 py-3 border-b
            transition-colors duration-150
            ${isDark ? 'border-white/10' : 'border-gray-200'}
          `}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className={`
                  text-base font-semibold
                  transition-colors duration-150
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}>
                  Ihre Dokumente
                </h2>
                <span className={`
                  text-xs px-2 py-0.5 rounded-full
                  transition-colors duration-150
                  ${isDark
                    ? 'bg-white/10 text-gray-400'
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  {totalDocuments}
                </span>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  text-sm font-medium
                  transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                <Plus size={16} />
                Hochladen
              </button>
            </div>
          </div>

          {/* Document List Component */}
          <div className="p-4">
            <DocumentList searchQuery={searchQuery} />
          </div>
        </div>

      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}
