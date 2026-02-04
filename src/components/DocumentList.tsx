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
import { File, Trash2, CheckSquare, Square, X, Tag, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDocuments } from '../contexts/DocumentContext';
import type { DocumentMetadata } from '../contexts/DocumentContext';
import { PermissionEditDialog } from './PermissionEditDialog';

interface DocumentItemProps {
  document: DocumentMetadata;
  onDelete: (id: string) => void;
  onEditPermissions: (document: DocumentMetadata) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

function DocumentRow({ document, onDelete, onEditPermissions, isSelectionMode, isSelected, onToggleSelect }: DocumentItemProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if user can edit permissions (owner, admin, or manager as fallback for legacy documents)
  const canEditPermissions = user && (
    user.id === document.metadata?.owner_id ||
    user.role === 'Admin' ||
    (user.role === 'Manager' && !document.metadata?.owner_id)
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Gerade eben';
    } else if (diffInHours < 24) {
      return `Vor ${Math.floor(diffInHours)}h`;
    } else if (diffInHours < 48) {
      return 'Gestern';
    } else {
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
    }
  };

  const handleDelete = () => {
    onDelete(document.id);
    setShowDeleteConfirm(false);
  };

  const handleRowClick = () => {
    if (isSelectionMode) {
      onToggleSelect(document.id);
    }
  };

  // Classification badge color
  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'public':
        return isDark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700';
      case 'confidential':
        return isDark ? 'bg-orange-900/40 text-orange-300' : 'bg-orange-100 text-orange-700';
      case 'restricted':
        return isDark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700';
      default: // internal
        return isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700';
    }
  };

  const getClassificationLabel = (classification?: string) => {
    switch (classification) {
      case 'public': return 'Öffentlich';
      case 'confidential': return 'Vertraulich';
      case 'restricted': return 'Streng vertraulich';
      default: return 'Intern';
    }
  };

  return (
    <tr
      onClick={handleRowClick}
      className={`
        group transition-colors duration-150
        ${isSelectionMode ? 'cursor-pointer' : ''}
        ${isSelected
          ? isDark ? 'bg-blue-900/30' : 'bg-blue-50'
          : isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
        }
      `}
    >
      {/* Checkbox / Icon Column */}
      <td className={`
        px-4 py-3 w-12
        ${isDark ? 'border-white/10' : 'border-gray-200'}
      `}>
        {isSelectionMode ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(document.id);
            }}
            className={isSelected
              ? isDark ? 'text-blue-400' : 'text-blue-600'
              : isDark ? 'text-gray-500' : 'text-gray-400'
            }
          >
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        ) : (
          <File className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
        )}
      </td>

      {/* Name Column */}
      <td className={`px-4 py-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex flex-col">
          <span
            className={`font-medium truncate max-w-xs ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
            title={document.originalName}
          >
            {document.originalName}
          </span>
          {/* Tags inline */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {document.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                    isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Tag className="w-2 h-2" />
                  {tag}
                </span>
              ))}
              {document.tags.length > 3 && (
                <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  +{document.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Category Column */}
      <td className={`px-4 py-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {document.category || 'Allgemein'}
        </span>
      </td>

      {/* Classification Column */}
      <td className={`px-4 py-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`
          inline-flex px-2 py-0.5 rounded text-xs font-medium
          ${getClassificationColor(document.metadata?.classification)}
        `}>
          {getClassificationLabel(document.metadata?.classification)}
        </span>
      </td>

      {/* Size Column */}
      <td className={`px-4 py-3 text-right ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {formatFileSize(document.size)}
        </span>
      </td>

      {/* Pages Column */}
      <td className={`px-4 py-3 text-center ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {document.pages}
        </span>
      </td>

      {/* Date Column */}
      <td className={`px-4 py-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {formatDate(document.uploadedAt)}
        </span>
      </td>

      {/* Actions Column */}
      <td className={`px-4 py-3 w-24 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        {!isSelectionMode && (
          <div className="flex items-center justify-end gap-1">
            {canEditPermissions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPermissions(document);
                }}
                className={`
                  p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all
                  ${isDark
                    ? 'text-gray-500 hover:text-blue-400 hover:bg-blue-900/20'
                    : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                  }
                `}
                title="Berechtigungen"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {!showDeleteConfirm ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className={`
                  p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all
                  ${isDark
                    ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/20'
                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }
                `}
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                >
                  Ja
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className={`px-2 py-1 text-xs rounded ${
                    isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Nein
                </button>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
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

interface DocumentListProps {
  /** Search query to filter documents by name */
  searchQuery?: string;
}

export function DocumentList({ searchQuery = '' }: DocumentListProps) {
  const { isDark } = useTheme();
  const { success: showSuccessToast } = useToast();
  const {
    documents,
    isLoading,
    deleteDocument,
    bulkDeleteDocuments,
    refreshDocuments,
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

  // Permission Edit Dialog state
  const [permissionEditDocument, setPermissionEditDocument] = useState<DocumentMetadata | null>(null);

  /**
   * Get German label for classification
   */
  const getClassificationLabel = (classification?: string): string => {
    switch (classification) {
      case 'public': return 'öffentlich';
      case 'confidential': return 'vertraulich';
      case 'restricted': return 'streng vertraulich';
      default: return 'intern';
    }
  };

  /**
   * Filter documents by search query
   */
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents;
    }
    const query = searchQuery.toLowerCase().trim();
    return documents.filter(doc => {
      // Search in name
      if (doc.originalName.toLowerCase().includes(query)) return true;
      // Search in category
      if (doc.category?.toLowerCase().includes(query)) return true;
      // Search in tags
      if (doc.tags?.some(tag => tag.toLowerCase().includes(query))) return true;
      // Search in classification (German label)
      const classificationLabel = getClassificationLabel(doc.metadata?.classification);
      if (classificationLabel.includes(query)) return true;
      // Search in classification (English value)
      if (doc.metadata?.classification?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [documents, searchQuery]);

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

  /**
   * Handle permission edit dialog open
   */
  const handleEditPermissions = (document: DocumentMetadata) => {
    setPermissionEditDocument(document);
  };

  /**
   * Handle permission save
   */
  const handleSavePermissions = async (
    documentId: string,
    permissions: {
      classification: 'public' | 'internal' | 'confidential' | 'restricted';
      visibility: 'only_me' | 'department' | 'all_users' | 'specific_users';
      specificUsers: string[];
    }
  ) => {
    const { updateDocumentPermissions } = await import('../lib/api');

    try {
      await updateDocumentPermissions(documentId, {
        classification: permissions.classification,
        visibility: permissions.visibility,
        specificUsers: permissions.specificUsers.length > 0 ? permissions.specificUsers : undefined
      });

      // Refresh documents to show updated permissions
      await refreshDocuments();

      // Close dialog
      setPermissionEditDocument(null);

      // Show success toast
      showSuccessToast('Berechtigungen erfolgreich aktualisiert');
    } catch (error) {
      console.error('Failed to update permissions:', error);
      throw error; // Re-throw so dialog can handle error display
    }
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

  return (
    <div>
      {/* Header with stats and selection controls */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h3
            className={`text-sm font-medium ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Dokumente
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

      {/* Document table */}
      <div className={`
        rounded-lg border overflow-hidden
        ${isDark ? 'border-white/10' : 'border-gray-200'}
      `}>
        <table className="w-full">
          <thead>
            <tr className={`
              text-xs font-medium
              ${isDark
                ? 'bg-white/5 text-gray-400 border-b border-white/10'
                : 'bg-gray-50 text-gray-500 border-b border-gray-200'
              }
            `}>
              <th className="px-4 py-3 text-left w-12">
                {/* Checkbox/Icon column */}
              </th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Kategorie</th>
              <th className="px-4 py-3 text-left">Klassifizierung</th>
              <th className="px-4 py-3 text-right">Größe</th>
              <th className="px-4 py-3 text-center">Seiten</th>
              <th className="px-4 py-3 text-left">Datum</th>
              <th className="px-4 py-3 w-24">
                {/* Actions column */}
              </th>
            </tr>
          </thead>
          <tbody className={`
            divide-y
            ${isDark ? 'divide-white/5' : 'divide-gray-100'}
          `}>
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <File className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {searchQuery.trim()
                      ? `Keine Dokumente für "${searchQuery}" gefunden`
                      : 'Keine Dokumente vorhanden'
                    }
                  </p>
                </td>
              </tr>
            ) : (
              filteredDocuments.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onDelete={deleteDocument}
                  onEditPermissions={handleEditPermissions}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(document.id)}
                  onToggleSelect={toggleSelectDocument}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk delete confirmation dialog */}
      {showBulkDeleteDialog && (
        <BulkDeleteDialog
          count={selectedCount}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteDialog(false)}
        />
      )}

      {/* Permission edit dialog */}
      {permissionEditDocument && (
        <PermissionEditDialog
          document={permissionEditDocument}
          isOpen={true}
          onClose={() => setPermissionEditDocument(null)}
          onSave={handleSavePermissions}
        />
      )}
    </div>
  );
}
