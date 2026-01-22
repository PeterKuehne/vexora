/**
 * PermissionEditDialog - Modal for editing document permissions
 *
 * Features:
 * - Edit classification, visibility, and specific users
 * - Role-based permission restrictions
 * - Live permission preview
 * - TailwindCSS styling with theme support (MANDATORY)
 * - Only owner or admin can edit permissions
 */

import { useState } from 'react';
import { X, Settings, Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { ClassificationDropdown, type ClassificationLevel } from './ClassificationDropdown';
import { VisibilitySelector, type VisibilityType } from './VisibilitySelector';
import { PermissionPreview } from './PermissionPreview';
import type { DocumentMetadata } from '../contexts/DocumentContext';

interface DocumentPermissionState {
  classification: ClassificationLevel;
  visibility: VisibilityType;
  specificUsers: string[];
}

interface PermissionEditDialogProps {
  document: DocumentMetadata;
  isOpen: boolean;
  onClose: () => void;
  onSave: (documentId: string, permissions: DocumentPermissionState) => Promise<void>;
}

export function PermissionEditDialog({ document, isOpen, onClose, onSave }: PermissionEditDialogProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // Initialize permissions from document metadata
  const [permissions, setPermissions] = useState<DocumentPermissionState>({
    classification: (document.metadata?.classification as ClassificationLevel) || 'internal',
    visibility: (document.metadata?.visibility as VisibilityType) || 'department',
    specificUsers: document.metadata?.specificUsers || []
  });

  // Check if user can edit this document (owner, admin, or manager as fallback for legacy documents)
  const canEdit = user && (
    user.id === document.metadata?.owner_id ||
    user.role === 'Admin' ||
    (user.role === 'Manager' && !document.metadata?.owner_id) // Fallback for legacy documents without owner_id
  );

  /**
   * Handle save permissions
   */
  const handleSave = async () => {
    if (!canEdit) return;

    setIsSaving(true);
    try {
      await onSave(document.id, permissions);
      onClose();
    } catch (error) {
      console.error('Failed to update permissions:', error);
      alert(`Fehler beim Aktualisieren der Berechtigungen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel/close
   */
  const handleCancel = () => {
    // Reset to original permissions
    setPermissions({
      classification: (document.metadata?.classification as ClassificationLevel) || 'internal',
      visibility: (document.metadata?.visibility as VisibilityType) || 'department',
      specificUsers: document.metadata?.specificUsers || []
    });
    onClose();
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Show access denied if user cannot edit
  if (!canEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className={`
            max-w-md w-full mx-4 p-6 rounded-xl shadow-xl
            ${isDark ? 'bg-gray-800' : 'bg-white'}
          `}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Zugriff verweigert
            </h3>
            <button
              onClick={onClose}
              className={`
                p-1 rounded-lg transition-colors
                ${isDark
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-600'
                }
              `}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Sie können nur die Berechtigungen von Dokumenten bearbeiten, die Sie selbst hochgeladen haben, oder wenn Sie Administrator sind.
          </p>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }
              `}
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`
          max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto
          rounded-xl shadow-xl
          ${isDark ? 'bg-gray-800' : 'bg-white'}
        `}
      >
        {/* Header */}
        <div
          className={`
            flex items-center justify-between p-6 border-b
            ${isDark ? 'border-gray-700' : 'border-gray-200'}
          `}
        >
          <div className="flex items-center gap-3">
            <Settings className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Berechtigungen bearbeiten
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {document.originalName}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className={`
              p-2 rounded-lg transition-colors
              ${isDark
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-600'
              }
            `}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Permission Configuration */}
            <div className="space-y-6">
              {/* Classification Dropdown */}
              <ClassificationDropdown
                value={permissions.classification}
                onChange={(classification) =>
                  setPermissions(prev => ({ ...prev, classification }))
                }
                disabled={isSaving}
              />

              {/* Visibility Selector */}
              <VisibilitySelector
                visibility={permissions.visibility}
                onVisibilityChange={(visibility) =>
                  setPermissions(prev => ({ ...prev, visibility }))
                }
                specificUsers={permissions.specificUsers}
                onSpecificUsersChange={(specificUsers) =>
                  setPermissions(prev => ({ ...prev, specificUsers }))
                }
                disabled={isSaving}
              />
            </div>

            {/* Permission Preview */}
            <div>
              <PermissionPreview
                classification={permissions.classification}
                visibility={permissions.visibility}
                specificUsers={permissions.specificUsers}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`
            flex justify-end gap-3 p-6 border-t
            ${isDark ? 'border-gray-700' : 'border-gray-200'}
          `}
        >
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg
              transition-colors duration-150
              ${isSaving
                ? 'opacity-50 cursor-not-allowed'
                : ''
              }
              ${isDark
                ? 'text-gray-300 border border-gray-600 hover:bg-gray-700'
                : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            Abbrechen
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              px-6 py-2 text-sm font-medium rounded-lg
              flex items-center gap-2
              transition-colors duration-150
              ${isSaving
                ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                : isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }
            `}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Berechtigungen speichern
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}