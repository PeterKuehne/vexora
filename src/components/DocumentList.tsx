/**
 * DocumentList - Display list of uploaded documents
 *
 * Features:
 * - Shows document metadata (name, size, pages, upload date)
 * - Delete action with confirmation
 * - Multi-select mode for bulk operations
 * - Bulk delete with confirmation dialog
 * - Loading and empty states
 * - Responsive design
 */

import { useState, useMemo } from 'react';
import { File, Trash2, Calendar, Hash, HardDrive, CheckSquare, Square, X, Search, Filter, Tag, FolderOpen, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments, DOCUMENT_CATEGORIES, type DocumentCategory } from '../contexts/DocumentContext';
import type { DocumentMetadata } from '../contexts/DocumentContext';

interface DocumentItemProps {
  document: DocumentMetadata;
  onDelete: (id: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

function DocumentItem({ document, onDelete, isSelectionMode, isSelected, onToggleSelect }: DocumentItemProps) {
  const { isDark } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Format upload date
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Gerade eben';
    } else if (diffInHours < 24) {
      return `Vor ${Math.floor(diffInHours)} Stunden`;
    } else if (diffInHours < 48) {
      return 'Gestern';
    } else {
      return date.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  };

  /**
   * Handle delete confirmation
   */
  const handleDelete = () => {
    onDelete(document.id);
    setShowDeleteConfirm(false);
  };

  /**
   * Handle click on item in selection mode
   */
  const handleItemClick = () => {
    if (isSelectionMode) {
      onToggleSelect(document.id);
    }
  };

  return (
    <div
      onClick={handleItemClick}
      className={`
        group p-4 rounded-lg border transition-all duration-150
        ${isSelectionMode ? 'cursor-pointer' : ''}
        ${isSelected
          ? isDark
            ? 'bg-blue-900/30 border-blue-600'
            : 'bg-blue-50 border-blue-400'
          : isDark
            ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/80'
            : 'bg-white border-gray-200 hover:bg-gray-50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox in selection mode, File Icon otherwise */}
        {isSelectionMode ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(document.id);
            }}
            className={`mt-1 flex-shrink-0 ${
              isSelected
                ? isDark ? 'text-blue-400' : 'text-blue-600'
                : isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {isSelected ? (
              <CheckSquare className="w-6 h-6" />
            ) : (
              <Square className="w-6 h-6" />
            )}
          </button>
        ) : (
          <File
            className={`w-8 h-8 mt-1 flex-shrink-0 ${
              isDark ? 'text-red-400' : 'text-red-500'
            }`}
          />
        )}

        {/* Document Info */}
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium truncate mb-1 ${
              isDark ? 'text-gray-200' : 'text-gray-800'
            }`}
            title={document.originalName}
          >
            {document.originalName}
          </h3>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span
              className={`flex items-center gap-1 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <HardDrive className="w-3 h-3" />
              {formatFileSize(document.size)}
            </span>

            <span
              className={`flex items-center gap-1 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <Hash className="w-3 h-3" />
              {document.pages} Seite{document.pages !== 1 ? 'n' : ''}
            </span>

            <span
              className={`flex items-center gap-1 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {formatDate(document.uploadedAt)}
            </span>

            {/* Category Badge */}
            {document.category && document.category !== 'Allgemein' && (
              <span
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  isDark
                    ? 'bg-blue-900/40 text-blue-300'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                <FolderOpen className="w-2.5 h-2.5" />
                {document.category}
              </span>
            )}
          </div>

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {document.tags.map((tag) => (
                <span
                  key={tag}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                    isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Tag className="w-2 h-2" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Delete Button (only in non-selection mode) */}
        {!isSelectionMode && (
          <div className="flex-shrink-0">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className={`
                  p-2 rounded-lg opacity-0 group-hover:opacity-100
                  transition-all duration-150
                  ${isDark
                    ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/20'
                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }
                `}
                title="Dokument löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={handleDelete}
                  className={`
                    px-2 py-1 text-xs rounded-md font-medium transition-colors
                    ${isDark
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                    }
                  `}
                >
                  Löschen
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`
                    px-2 py-1 text-xs rounded-md font-medium transition-colors
                    ${isDark
                      ? 'bg-gray-600 hover:bg-gray-700 text-gray-200'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }
                  `}
                >
                  Abbrechen
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Bulk Delete Confirmation Dialog
 */
interface BulkDeleteDialogProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function BulkDeleteDialog({ count, onConfirm, onCancel }: BulkDeleteDialogProps) {
  const { isDark } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`
          max-w-md w-full mx-4 p-6 rounded-xl shadow-xl
          ${isDark ? 'bg-gray-800' : 'bg-white'}
        `}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${isDark ? 'bg-red-900/30' : 'bg-red-100'}`}>
            <Trash2 className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
          </div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {count} Dokument{count !== 1 ? 'e' : ''} löschen?
          </h3>
        </div>

        <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Diese Aktion kann nicht rückgängig gemacht werden. Alle ausgewählten Dokumente und ihre Vektordaten werden dauerhaft gelöscht.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }
            `}
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isDark
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
              }
            `}
          >
            {count} Dokument{count !== 1 ? 'e' : ''} löschen
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentList() {
  const { isDark } = useTheme();
  const {
    documents,
    isLoading,
    deleteDocument,
    bulkDeleteDocuments,
    totalDocuments,
    totalSize,
    isSelectionMode,
    selectedIds,
    selectedCount,
    toggleSelectionMode,
    toggleSelectDocument,
    selectAllDocuments,
    clearSelection,
  } = useDocuments();

  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  /**
   * Get all unique tags from documents
   */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    documents.forEach(doc => {
      doc.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [documents]);

  /**
   * Toggle a tag in the filter selection
   */
  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setCategoryFilter('all');
    setSelectedTags(new Set());
    setSearchQuery('');
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = categoryFilter !== 'all' || selectedTags.size > 0 || searchQuery.trim() !== '';

  /**
   * Filter documents by search query, category, and tags (AND combination)
   */
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        if (!doc.originalName.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all') {
        if (doc.category !== categoryFilter) {
          return false;
        }
      }

      // Tag filter (AND - all selected tags must be present)
      if (selectedTags.size > 0) {
        const docTags = new Set(doc.tags || []);
        for (const tag of selectedTags) {
          if (!docTags.has(tag)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [documents, searchQuery, categoryFilter, selectedTags]);

  /**
   * Format total size
   */
  const formatTotalSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  /**
   * Handle bulk delete confirmation
   */
  const handleBulkDelete = async () => {
    await bulkDeleteDocuments(Array.from(selectedIds));
    setShowBulkDeleteDialog(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`
              p-4 rounded-lg border animate-pulse
              ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}
            `}
          >
            <div className="flex gap-3">
              <div
                className={`w-8 h-8 rounded ${
                  isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}
              />
              <div className="flex-1">
                <div
                  className={`h-4 rounded mb-2 ${
                    isDark ? 'bg-gray-700' : 'bg-gray-300'
                  }`}
                  style={{ width: `${60 + i * 10}%` }}
                />
                <div
                  className={`h-3 rounded ${
                    isDark ? 'bg-gray-700' : 'bg-gray-300'
                  }`}
                  style={{ width: '40%' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state (no documents at all)
  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <File
          className={`w-16 h-16 mx-auto mb-4 ${
            isDark ? 'text-gray-600' : 'text-gray-300'
          }`}
        />
        <h3
          className={`text-lg font-medium mb-2 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Keine Dokumente vorhanden
        </h3>
        <p
          className={`text-sm ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          Laden Sie ein PDF-Dokument hoch, um zu beginnen
        </p>
      </div>
    );
  }

  // No search results state
  // No results when filters are active but no documents match
  const showNoResults = hasActiveFilters && filteredDocuments.length === 0;

  return (
    <div>
      {/* Search field */}
      <div className="mb-3">
        <div
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
            ${isDark
              ? 'bg-gray-800/50 border-gray-700 focus-within:border-blue-500'
              : 'bg-white border-gray-200 focus-within:border-blue-400'
            }
          `}
        >
          <Search
            className={`w-4 h-4 flex-shrink-0 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Dokumente durchsuchen..."
            className={`
              flex-1 bg-transparent text-sm outline-none
              ${isDark
                ? 'text-gray-200 placeholder-gray-500'
                : 'text-gray-800 placeholder-gray-400'
              }
            `}
            aria-label="Dokumente nach Namen durchsuchen"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`
                p-0.5 rounded transition-colors
                ${isDark
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }
              `}
              title="Suche zurücksetzen"
              aria-label="Suchfeld leeren"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${showFilterPanel || hasActiveFilters
                ? isDark
                  ? 'bg-blue-900/40 text-blue-300 border border-blue-700'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                : isDark
                  ? 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }
            `}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {hasActiveFilters && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                isDark ? 'bg-blue-700' : 'bg-blue-200'
              }`}>
                {(categoryFilter !== 'all' ? 1 : 0) + selectedTags.size}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilterPanel ? 'rotate-180' : ''}`} />
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className={`
                flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors
                ${isDark
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <X className="w-3 h-3" />
              Filter zurücksetzen
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div
            className={`
              mt-3 p-3 rounded-lg border
              ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}
            `}
          >
            {/* Category Filter */}
            <div className="mb-3">
              <label
                className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Kategorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | 'all')}
                className={`
                  w-full px-3 py-2 rounded-lg text-sm border transition-colors
                  ${isDark
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-300 text-gray-800'
                  }
                `}
                aria-label="Kategorie-Filter"
              >
                <option value="all">Alle Kategorien</option>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div>
                <label
                  className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  Tags {selectedTags.size > 0 && `(${selectedTags.size} ausgewählt)`}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTagFilter(tag)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors
                        ${selectedTags.has(tag)
                          ? isDark
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                          : isDark
                            ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                        }
                      `}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allTags.length === 0 && (
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Keine Tags vorhanden. Tags können beim Upload oder später hinzugefügt werden.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Header with stats and selection controls */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h3
            className={`text-sm font-medium ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            {hasActiveFilters
              ? `${filteredDocuments.length} von ${totalDocuments} Dokumente${filteredDocuments.length !== 1 ? 'n' : ''}`
              : 'Dokumente'
            }
          </h3>

          {/* Selection mode controls */}
          {isSelectionMode ? (
            <div className="flex items-center gap-2">
              <span
                className={`text-xs ${
                  isDark ? 'text-blue-400' : 'text-blue-600'
                }`}
              >
                {selectedCount} ausgewählt
              </span>
              <button
                onClick={selectAllDocuments}
                className={`
                  text-xs px-2 py-1 rounded transition-colors
                  ${isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                Alle
              </button>
              <button
                onClick={clearSelection}
                className={`
                  text-xs px-2 py-1 rounded transition-colors
                  ${isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                Keine
              </button>
              <button
                onClick={toggleSelectionMode}
                className={`
                  p-1 rounded transition-colors
                  ${isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }
                `}
                title="Auswahl beenden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span
                className={`text-xs ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {totalDocuments} Datei{totalDocuments !== 1 ? 'en' : ''} • {formatTotalSize(totalSize)}
              </span>
              {totalDocuments > 1 && (
                <button
                  onClick={toggleSelectionMode}
                  className={`
                    flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors
                    ${isDark
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  title="Mehrere auswählen"
                >
                  <CheckSquare className="w-3 h-3" />
                  Auswählen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bulk delete button */}
        {isSelectionMode && selectedCount > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowBulkDeleteDialog(true)}
              className={`
                flex items-center gap-2 w-full px-3 py-2 rounded-lg font-medium transition-colors
                ${isDark
                  ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                  : 'bg-red-50 hover:bg-red-100 text-red-600'
                }
              `}
            >
              <Trash2 className="w-4 h-4" />
              {selectedCount} Dokument{selectedCount !== 1 ? 'e' : ''} löschen
            </button>
          </div>
        )}
      </div>

      {/* Document list or no results message */}
      {showNoResults ? (
        <div className="text-center py-6">
          <Filter
            className={`w-12 h-12 mx-auto mb-3 ${
              isDark ? 'text-gray-600' : 'text-gray-300'
            }`}
          />
          <h3
            className={`text-sm font-medium mb-1 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            Keine Ergebnisse
          </h3>
          <p
            className={`text-xs ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {searchQuery.trim()
              ? `Keine Dokumente für "${searchQuery}" gefunden`
              : categoryFilter !== 'all'
                ? `Keine Dokumente in Kategorie "${categoryFilter}"`
                : selectedTags.size > 0
                  ? `Keine Dokumente mit den ausgewählten Tags`
                  : 'Keine passenden Dokumente gefunden'
            }
          </p>
          <button
            onClick={clearFilters}
            className={`
              mt-3 text-xs px-3 py-1.5 rounded-lg transition-colors
              ${isDark
                ? 'text-blue-400 hover:bg-blue-900/30'
                : 'text-blue-600 hover:bg-blue-50'
              }
            `}
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocuments.map((document) => (
            <DocumentItem
              key={document.id}
              document={document}
              onDelete={deleteDocument}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(document.id)}
              onToggleSelect={toggleSelectDocument}
            />
          ))}
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
      {showBulkDeleteDialog && (
        <BulkDeleteDialog
          count={selectedCount}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteDialog(false)}
        />
      )}
    </div>
  );
}
