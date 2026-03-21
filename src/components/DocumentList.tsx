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
 * - Refined design with classification accents and elegant badges
 */

import { useState, useMemo } from 'react';
import { File, Trash2, CheckSquare, Square, X, Tag, Settings, FileText } from 'lucide-react';
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

  // Classification accent color (left border)
  const getClassificationAccent = (classification?: string) => {
    switch (classification) {
      case 'public':
        return isDark ? 'border-l-emerald-500/60' : 'border-l-emerald-400';
      case 'confidential':
        return isDark ? 'border-l-amber-500/60' : 'border-l-amber-400';
      case 'restricted':
        return isDark ? 'border-l-red-500/60' : 'border-l-red-400';
      default: // internal
        return isDark ? 'border-l-blue-500/60' : 'border-l-blue-400';
    }
  };

  // Classification badge styling
  const getClassificationBadge = (classification?: string) => {
    switch (classification) {
      case 'public':
        return isDark
          ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
          : 'bg-emerald-50 text-emerald-600 ring-emerald-200/60';
      case 'confidential':
        return isDark
          ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
          : 'bg-amber-50 text-amber-600 ring-amber-200/60';
      case 'restricted':
        return isDark
          ? 'bg-red-500/10 text-red-400 ring-red-500/20'
          : 'bg-red-50 text-red-600 ring-red-200/60';
      default: // internal
        return isDark
          ? 'bg-blue-500/10 text-blue-400 ring-blue-500/20'
          : 'bg-blue-50 text-blue-600 ring-blue-200/60';
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
        group transition-all duration-150
        border-l-2
        ${getClassificationAccent(document.metadata?.classification)}
        ${isSelectionMode ? 'cursor-pointer' : ''}
        ${isSelected
          ? isDark ? 'bg-blue-500/8' : 'bg-blue-50/70'
          : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/70'
        }
      `}
    >
      {/* Checkbox / Icon Column */}
      <td className="px-4 py-3 w-10">
        {isSelectionMode ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(document.id);
            }}
            className={`
              transition-colors duration-150
              ${isSelected
                ? isDark ? 'text-blue-400' : 'text-blue-600'
                : isDark ? 'text-gray-600' : 'text-gray-300'
              }
            `}
          >
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        ) : (
          <div className={`
            p-1.5 rounded-lg
            ${isDark ? 'bg-white/5' : 'bg-gray-50'}
          `}>
            <FileText className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
        )}
      </td>

      {/* Name Column */}
      <td className="px-3 py-3">
        <div className="flex flex-col">
          <span
            className={`
              text-[13px] font-medium truncate max-w-xs
              ${isDark ? 'text-gray-200' : 'text-gray-800'}
            `}
            title={document.originalName}
          >
            {document.originalName}
          </span>
          {/* Tags inline */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {document.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className={`
                    inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium
                    ${isDark
                      ? 'bg-white/5 text-gray-500'
                      : 'bg-gray-100 text-gray-400'
                    }
                  `}
                >
                  <Tag className="w-2 h-2" />
                  {tag}
                </span>
              ))}
              {document.tags.length > 3 && (
                <span className={`text-[10px] tabular-nums ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                  +{document.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Category Column */}
      <td className="px-3 py-3">
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {document.category || 'Allgemein'}
        </span>
      </td>

      {/* Classification Column */}
      <td className="px-3 py-3">
        <span className={`
          inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ring-1
          ${getClassificationBadge(document.metadata?.classification)}
        `}>
          {getClassificationLabel(document.metadata?.classification)}
        </span>
      </td>

      {/* Size Column */}
      <td className="px-3 py-3 text-right">
        <span className={`text-xs tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {formatFileSize(document.size)}
        </span>
      </td>

      {/* Pages Column */}
      <td className="px-3 py-3 text-center">
        <span className={`text-xs tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {document.pages}
        </span>
      </td>

      {/* Date Column */}
      <td className="px-3 py-3">
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {formatDate(document.uploadedAt)}
        </span>
      </td>

      {/* Actions Column */}
      <td className="px-3 py-3 w-20">
        {!isSelectionMode && (
          <div className="flex items-center justify-end gap-0.5">
            {canEditPermissions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPermissions(document);
                }}
                className={`
                  p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200
                  ${isDark
                    ? 'text-gray-600 hover:text-blue-400 hover:bg-blue-500/10'
                    : 'text-gray-300 hover:text-blue-600 hover:bg-blue-50'
                  }
                `}
                title="Berechtigungen"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}

            {!showDeleteConfirm ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className={`
                  p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200
                  ${isDark
                    ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                  }
                `}
                title="Löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="px-2 py-1 text-[11px] font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Ja
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    isDark ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`
          max-w-md w-full mx-4 p-6 rounded-2xl shadow-2xl animate-scaleIn
          ${isDark ? 'bg-surface border border-white/10' : 'bg-white border border-gray-200'}
        `}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
            <Trash2 className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          </div>
          <div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {count} Dokument{count !== 1 ? 'e' : ''} löschen?
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Diese Aktion kann nicht rückgängig gemacht werden
            </p>
          </div>
        </div>

        <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Alle ausgewählten Dokumente und ihre Vektordaten werden dauerhaft gelöscht.
        </p>

        <div className="flex gap-2.5 justify-end">
          <button
            onClick={onCancel}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${isDark
                ? 'bg-white/5 hover:bg-white/10 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }
            `}
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
          >
            {count} löschen
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
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`
              p-4 rounded-xl animate-pulse
              ${isDark ? 'bg-white/[0.02]' : 'bg-gray-50'}
            `}
          >
            <div className="flex gap-3 items-center">
              <div
                className={`w-8 h-8 rounded-lg ${
                  isDark ? 'bg-white/5' : 'bg-gray-200'
                }`}
              />
              <div className="flex-1">
                <div
                  className={`h-3.5 rounded-md mb-2 ${
                    isDark ? 'bg-white/5' : 'bg-gray-200'
                  }`}
                  style={{ width: `${50 + i * 12}%` }}
                />
                <div
                  className={`h-2.5 rounded-md ${
                    isDark ? 'bg-white/[0.03]' : 'bg-gray-100'
                  }`}
                  style={{ width: '35%' }}
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
      <div className="text-center py-12">
        <div className={`
          inline-flex p-4 rounded-2xl mb-4
          ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'}
        `}>
          <File className={`w-10 h-10 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
        </div>
        <h3 className={`text-sm font-semibold mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Keine Dokumente vorhanden
        </h3>
        <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          Laden Sie ein Dokument hoch, um zu beginnen
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with stats and selection controls */}
      <div className="mb-3">
        <div className="flex justify-between items-center">
          <h3 className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Dokumente
          </h3>

          {/* Selection mode controls */}
          {isSelectionMode ? (
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-medium tabular-nums ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {selectedCount} ausgewählt
              </span>
              <button
                onClick={selectAllDocuments}
                className={`
                  text-[11px] px-2 py-1 rounded-md transition-colors font-medium
                  ${isDark
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                Alle
              </button>
              <button
                onClick={clearSelection}
                className={`
                  text-[11px] px-2 py-1 rounded-md transition-colors font-medium
                  ${isDark
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                Keine
              </button>
              <button
                onClick={toggleSelectionMode}
                className={`
                  p-1 rounded-md transition-colors
                  ${isDark
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }
                `}
                title="Auswahl beenden"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className={`text-[11px] tabular-nums ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                {totalDocuments} Datei{totalDocuments !== 1 ? 'en' : ''} · {formatTotalSize(totalSize)}
              </span>
              {totalDocuments > 1 && (
                <button
                  onClick={toggleSelectionMode}
                  className={`
                    flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors font-medium
                    ${isDark
                      ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
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
          <div className="mt-2.5">
            <button
              onClick={() => setShowBulkDeleteDialog(true)}
              className={`
                flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors
                ${isDark
                  ? 'bg-red-500/10 hover:bg-red-500/15 text-red-400 ring-1 ring-red-500/20'
                  : 'bg-red-50 hover:bg-red-100 text-red-600 ring-1 ring-red-200/60'
                }
              `}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {selectedCount} Dokument{selectedCount !== 1 ? 'e' : ''} löschen
            </button>
          </div>
        )}
      </div>

      {/* Document table */}
      <div className={`
        rounded-xl overflow-hidden
        ${isDark ? 'ring-1 ring-white/[0.06]' : 'ring-1 ring-gray-200/80'}
      `}>
        <table className="w-full">
          <thead>
            <tr className={`
              text-[11px] font-medium uppercase tracking-wider
              ${isDark
                ? 'bg-white/[0.02] text-gray-500 border-b border-white/[0.06]'
                : 'bg-gray-50/80 text-gray-400 border-b border-gray-100'
              }
            `}>
              <th className="px-4 py-2.5 text-left w-10">
                {/* Checkbox/Icon column */}
              </th>
              <th className="px-3 py-2.5 text-left">Name</th>
              <th className="px-3 py-2.5 text-left">Kategorie</th>
              <th className="px-3 py-2.5 text-left">Klassifizierung</th>
              <th className="px-3 py-2.5 text-right">Größe</th>
              <th className="px-3 py-2.5 text-center">Seiten</th>
              <th className="px-3 py-2.5 text-left">Datum</th>
              <th className="px-3 py-2.5 w-20">
                {/* Actions column */}
              </th>
            </tr>
          </thead>
          <tbody className={`
            divide-y
            ${isDark ? 'divide-white/[0.04]' : 'divide-gray-50'}
          `}>
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <div className={`
                    inline-flex p-3 rounded-xl mb-3
                    ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'}
                  `}>
                    <File className={`w-8 h-8 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                  </div>
                  <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
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
