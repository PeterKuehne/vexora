/**
 * Documents Page - Complete Document Management Interface
 * Full-screen document management (NOT sidebar) with upload, list, and search
 * Follows MANDATORY TailwindCSS styling convention with theme support
 * Refined editorial design with integrated stat strip and layered surfaces
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { useAuth } from '../contexts/AuthContext';
import { DocumentUploadWithPermissions } from '../components/DocumentUploadWithPermissions';
import { DocumentList } from '../components/DocumentList';
import { StorageQuotaDisplay } from '../components/StorageQuotaDisplay';
import {
  Search, Filter, Upload, FileText, TrendingUp, Users, Clock,
  X, ChevronDown, ChevronUp, Database
} from 'lucide-react';

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

  const statItems = [
    {
      icon: FileText,
      value: documentStats.total.toString(),
      label: 'Dokumente',
      color: isDark ? 'text-blue-400' : 'text-blue-600',
      iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
    },
    {
      icon: Clock,
      value: documentStats.recent.toString(),
      label: 'Letzte 24h',
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
      min-h-screen
      transition-colors duration-150
      ${isDark ? 'bg-background' : 'bg-gray-50/50'}
    `}>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Header Section */}
        <div className="mb-8 animate-stagger-1">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`
                  p-2 rounded-xl
                  ${isDark ? 'bg-white/5' : 'bg-white shadow-sm'}
                `}>
                  <Database size={20} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
                </div>
                <h1 className={`
                  text-2xl font-bold tracking-tight
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}>
                  Dokumente
                </h1>
              </div>
              <p className={`
                text-sm pl-0.5
                ${isDark ? 'text-gray-500' : 'text-gray-500'}
              `}>
                Verwalten Sie Ihre Dokumente mit Enterprise-Sicherheit und Berechtigungen
              </p>
            </div>

            <button
              onClick={() => setShowUploadArea(!showUploadArea)}
              className={`
                group flex items-center gap-2.5 px-5 py-2.5 rounded-xl
                text-sm font-semibold
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100 focus:ring-offset-background shadow-lg shadow-white/5'
                  : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-offset-gray-50 shadow-lg shadow-gray-900/20'
                }
              `}
            >
              <Upload size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
              Hochladen
              {showUploadArea ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Integrated Stat Strip */}
        <div className={`
          animate-stagger-2
          mb-6 rounded-2xl overflow-hidden
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
                    flex items-center gap-3 px-5 py-4
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
                  <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                    <Icon size={16} className={stat.color} />
                  </div>
                  <div>
                    <div className={`text-lg font-bold tabular-nums ${stat.color}`}>
                      {stat.value}
                    </div>
                    <div className={`text-[11px] font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Storage Quota */}
        <div className="mb-6 animate-stagger-3">
          <StorageQuotaDisplay
            showDetails={true}
            onQuotaLoaded={(usage) => {
              console.log('User quota loaded:', usage);
            }}
          />
        </div>

        {/* Upload Area - Collapsible */}
        {showUploadArea && (
          <div className={`
            mb-6 rounded-2xl overflow-hidden animate-fadeInDown
            ${isDark
              ? 'bg-white/[0.03] border border-white/[0.06]'
              : 'bg-white border border-gray-200/80 shadow-sm'
            }
          `}>
            <div className={`
              px-6 py-4 border-b
              ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}
            `}>
              <h2 className={`
                text-sm font-semibold
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Neues Dokument hochladen
              </h2>
              <p className={`
                text-xs mt-0.5
                ${isDark ? 'text-gray-500' : 'text-gray-400'}
              `}>
                PDF, DOCX, PPTX, XLSX, HTML, Markdown oder Text mit Berechtigungen
              </p>
            </div>
            <div className="p-6">
              <DocumentUploadWithPermissions />
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="mb-6 animate-stagger-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative group">
              <Search
                size={16}
                className={`
                  absolute left-4 top-1/2 transform -translate-y-1/2
                  transition-colors duration-200
                  ${isDark
                    ? 'text-gray-600 group-focus-within:text-gray-400'
                    : 'text-gray-300 group-focus-within:text-gray-500'
                  }
                `}
              />
              <input
                type="text"
                placeholder="Dokumente durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`
                  w-full pl-11 pr-10 py-2.5 rounded-xl
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
                    p-1 rounded-md transition-colors
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
            <button className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl
              text-sm font-medium
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-gray-500/30
              ${isDark
                ? 'bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-gray-300 hover:bg-white/[0.05]'
                : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 shadow-sm'
              }
            `}>
              <Filter size={14} />
              Filter
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className={`
          animate-stagger-5
          rounded-2xl overflow-hidden
          ${isDark
            ? 'bg-white/[0.03] border border-white/[0.06]'
            : 'bg-white border border-gray-200/80 shadow-sm'
          }
        `}>
          <div className={`
            px-6 py-4 border-b
            ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}
          `}>
            <div className="flex items-center justify-between">
              <h2 className={`
                text-sm font-semibold
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Ihre Dokumente
              </h2>
              <span className={`
                text-xs tabular-nums px-2.5 py-1 rounded-full
                ${isDark
                  ? 'bg-white/5 text-gray-500'
                  : 'bg-gray-100 text-gray-500'
                }
              `}>
                {totalDocuments} {totalDocuments === 1 ? 'Dokument' : 'Dokumente'}
              </span>
            </div>
          </div>

          <div className="p-6">
            <DocumentList searchQuery={searchQuery} />
          </div>
        </div>

      </div>
    </div>
  );
}
