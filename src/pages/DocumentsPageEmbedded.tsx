/**
 * Documents Page Embedded - Document Management for Main Content Area
 * Embedded version of DocumentsPage for use within the chat layout
 * Follows MANDATORY TailwindCSS styling convention with theme support
 * Refined design with integrated stat strip and layered surfaces
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { useAuth } from '../contexts/AuthContext';
import { DocumentList } from '../components/DocumentList';
import { StorageQuotaDisplay } from '../components/StorageQuotaDisplay';
import { UploadModal } from '../components/UploadModal';
import { Search, Plus, FileText, TrendingUp, Users, Clock, X, Database } from 'lucide-react';

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

  const statItems = [
    {
      icon: FileText,
      value: documentStats.total.toString(),
      label: 'Gesamt',
      color: isDark ? 'text-blue-400' : 'text-blue-600',
      iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
    },
    {
      icon: Clock,
      value: documentStats.recent.toString(),
      label: '24h',
      color: isDark ? 'text-emerald-400' : 'text-emerald-600',
      iconBg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
    },
    {
      icon: TrendingUp,
      value: formatFileSize(documentStats.size),
      label: 'Speicher',
      color: isDark ? 'text-violet-400' : 'text-violet-600',
      iconBg: isDark ? 'bg-violet-500/10' : 'bg-violet-50',
    },
    {
      icon: Users,
      value: user?.role === 'Admin' ? 'Alle' : user?.department || 'Eigene',
      label: 'Zugriff',
      color: isDark ? 'text-amber-400' : 'text-amber-600',
      iconBg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
    },
  ];

  return (
    <div className={`
      h-full overflow-auto scrollbar-thin
      transition-colors duration-150
      ${isDark ? 'bg-background' : 'bg-gray-50/50'}
    `}>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">

        {/* Header Section - Compact */}
        <div className="mb-5 animate-stagger-1">
          <div className="flex items-center gap-2.5 mb-1">
            <div className={`
              p-1.5 rounded-lg
              ${isDark ? 'bg-white/5' : 'bg-white shadow-sm'}
            `}>
              <Database size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
            </div>
            <h1 className={`
              text-lg font-bold tracking-tight
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              RAG Dokumente
            </h1>
          </div>
          <p className={`
            text-xs pl-0.5
            ${isDark ? 'text-gray-500' : 'text-gray-400'}
          `}>
            Verwalten Sie Ihre Dokumente für die RAG-Suche
          </p>
        </div>

        {/* Integrated Stat Strip - Compact */}
        <div className={`
          animate-stagger-2
          mb-5 rounded-xl overflow-hidden
          ${isDark
            ? 'bg-white/[0.03] border border-white/[0.06]'
            : 'bg-white border border-gray-200/80 shadow-sm'
          }
        `}>
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {statItems.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`
                    flex items-center gap-2.5 px-4 py-3
                    ${index < statItems.length - 1
                      ? isDark
                        ? 'lg:border-r border-white/[0.06]'
                        : 'lg:border-r border-gray-100'
                      : ''
                    }
                    ${index < 2
                      ? isDark
                        ? 'border-b lg:border-b-0 border-white/[0.06]'
                        : 'border-b lg:border-b-0 border-gray-100'
                      : ''
                    }
                  `}
                >
                  <div className={`p-1.5 rounded-md ${stat.iconBg}`}>
                    <Icon size={14} className={stat.color} />
                  </div>
                  <div>
                    <div className={`text-base font-bold tabular-nums leading-tight ${stat.color}`}>
                      {stat.value}
                    </div>
                    <div className={`text-[10px] font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Storage Quota - Compact */}
        <div className="mb-5 animate-stagger-3">
          <StorageQuotaDisplay
            showDetails={false}
            onQuotaLoaded={(usage) => {
              console.log('User quota loaded:', usage);
            }}
          />
        </div>

        {/* Search Bar */}
        <div className="mb-4 animate-stagger-4">
          <div className="relative group">
            <Search
              size={15}
              className={`
                absolute left-3.5 top-1/2 transform -translate-y-1/2
                transition-colors duration-200
                ${isDark
                  ? 'text-gray-600 group-focus-within:text-gray-400'
                  : 'text-gray-300 group-focus-within:text-gray-500'
                }
              `}
            />
            <input
              type="text"
              placeholder="Name, Kategorie oder Tags durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`
                w-full pl-10 pr-10 py-2 rounded-xl
                text-sm
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500/40
                ${isDark
                  ? 'bg-white/[0.03] border border-white/[0.06] text-white placeholder-gray-600 focus:bg-white/[0.05] focus:border-white/10'
                  : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300 shadow-sm'
                }
              `}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`
                  absolute right-3 top-1/2 transform -translate-y-1/2
                  p-0.5 rounded-md transition-colors
                  ${isDark
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-white/10'
                    : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                  }
                `}
                title="Suche zurücksetzen"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Document List */}
        <div className={`
          animate-stagger-5
          rounded-xl overflow-hidden
          ${isDark
            ? 'bg-white/[0.03] border border-white/[0.06]'
            : 'bg-white border border-gray-200/80 shadow-sm'
          }
        `}>
          <div className={`
            px-4 py-3 border-b
            ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}
          `}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className={`
                  text-[13px] font-semibold
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}>
                  Ihre Dokumente
                </h2>
                <span className={`
                  text-[11px] tabular-nums px-2 py-0.5 rounded-full
                  ${isDark
                    ? 'bg-white/5 text-gray-500'
                    : 'bg-gray-100 text-gray-500'
                  }
                `}>
                  {totalDocuments}
                </span>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className={`
                  group flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
                  text-xs font-semibold
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500/40
                  ${isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm shadow-white/5'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm shadow-gray-900/10'
                  }
                `}
              >
                <Plus size={14} className="transition-transform duration-200 group-hover:rotate-90" />
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
