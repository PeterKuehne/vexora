/**
 * DocumentList - Display list of uploaded documents
 *
 * Features:
 * - Shows document metadata (name, size, pages, upload date)
 * - Delete action with confirmation
 * - Loading and empty states
 * - Responsive design
 */

import { useState } from 'react';
import { File, Trash2, Calendar, Hash, HardDrive } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import type { DocumentMetadata } from '../contexts/DocumentContext';

interface DocumentItemProps {
  document: DocumentMetadata;
  onDelete: (id: string) => void;
}

function DocumentItem({ document, onDelete }: DocumentItemProps) {
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

  return (
    <div
      className={`
        group p-4 rounded-lg border transition-all duration-150
        ${isDark
          ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/80'
          : 'bg-white border-gray-200 hover:bg-gray-50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* File Icon */}
        <File
          className={`w-8 h-8 mt-1 flex-shrink-0 ${
            isDark ? 'text-red-400' : 'text-red-500'
          }`}
        />

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
          </div>
        </div>

        {/* Delete Button */}
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
      </div>
    </div>
  );
}

export function DocumentList() {
  const { isDark } = useTheme();
  const { documents, isLoading, deleteDocument, totalDocuments, totalSize } = useDocuments();

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

  // Empty state
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
      {/* Header with stats */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h3
            className={`text-sm font-medium ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Dokumente
          </h3>
          <span
            className={`text-xs ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {totalDocuments} Datei{totalDocuments !== 1 ? 'en' : ''} • {formatTotalSize(totalSize)}
          </span>
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((document) => (
          <DocumentItem
            key={document.id}
            document={document}
            onDelete={deleteDocument}
          />
        ))}
      </div>
    </div>
  );
}