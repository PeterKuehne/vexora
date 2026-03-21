/**
 * PermissionEditDialog - Refined modal for editing document permissions
 *
 * Features:
 * - Edit classification, visibility, and specific users
 * - Role-based permission restrictions
 * - Live permission preview
 * - TailwindCSS styling with theme support (MANDATORY)
 * - Only owner or admin can edit permissions
 * - Separate backdrop div pattern (matching UploadModal)
 * - ESC key to close, click-outside to close
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Save } from 'lucide-react';
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

  // Check if user can edit this document
  const canEdit = user && (
    user.id === document.metadata?.owner_id ||
    user.role === 'Admin' ||
    (user.role === 'Manager' && !document.metadata?.owner_id)
  );

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

  const handleCancel = useCallback(() => {
    setPermissions({
      classification: (document.metadata?.classification as ClassificationLevel) || 'internal',
      visibility: (document.metadata?.visibility as VisibilityType) || 'department',
      specificUsers: document.metadata?.specificUsers || []
    });
    onClose();
  }, [document.metadata, onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSaving, handleCancel]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      globalThis.document.body.style.overflow = 'hidden';
    }
    return () => {
      globalThis.document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Access denied state
  if (!canEdit) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop — separate div */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog */}
        <div
          className={`
            relative max-w-md w-full mx-4 p-6 rounded-2xl shadow-2xl animate-scaleIn
            ${isDark ? 'bg-neutral-900 border border-white/[0.08]' : 'bg-white border border-gray-200/80'}
          `}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Zugriff verweigert
            </h3>
            <button
              onClick={onClose}
              className={`
                p-1.5 rounded-xl transition-colors
                ${isDark
                  ? 'hover:bg-white/5 text-gray-500'
                  : 'hover:bg-gray-100 text-gray-300'
                }
              `}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Sie können nur die Berechtigungen von Dokumenten bearbeiten, die Sie selbst hochgeladen haben, oder wenn Sie Administrator sind.
          </p>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${isDark
                  ? 'bg-white/5 hover:bg-white/10 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }
              `}
            >
              Schließen
            </button>
          </div>
        </div>
      </div>,
      globalThis.document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — separate div (same pattern as UploadModal) */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isSaving && handleCancel()}
      />

      {/* Modal — needs 'relative' to stack above the absolute backdrop */}
      <div
        className={`
          relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin
          rounded-2xl shadow-2xl animate-scaleIn
          ${isDark ? 'bg-neutral-900 border border-white/[0.08]' : 'bg-white border border-gray-200/80'}
        `}
      >
        {/* Header */}
        <div
          className={`
            sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b
            ${isDark
              ? 'bg-neutral-900/95 backdrop-blur-md border-white/[0.06]'
              : 'bg-white/95 backdrop-blur-md border-gray-100'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-xl
              ${isDark ? 'bg-white/5' : 'bg-gray-50'}
            `}>
              <Shield size={18} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Berechtigungen bearbeiten
              </h3>
              <p className={`text-xs truncate max-w-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {document.originalName}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className={`
              p-2 rounded-xl transition-colors
              ${isDark
                ? 'hover:bg-white/5 text-gray-500 hover:text-gray-300'
                : 'hover:bg-gray-100 text-gray-300 hover:text-gray-500'
              }
            `}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Permission Configuration */}
            <div className="space-y-6">
              <ClassificationDropdown
                value={permissions.classification}
                onChange={(classification) =>
                  setPermissions(prev => ({ ...prev, classification }))
                }
                disabled={isSaving}
              />

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
            sticky bottom-0 flex justify-end gap-2.5 px-6 py-4 border-t
            ${isDark
              ? 'bg-neutral-900/95 backdrop-blur-md border-white/[0.06]'
              : 'bg-white/95 backdrop-blur-md border-gray-100'
            }
          `}
        >
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className={`
              px-4 py-2 text-sm font-medium rounded-xl
              transition-colors duration-150
              ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
              ${isDark
                ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            Abbrechen
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              px-5 py-2 text-sm font-semibold rounded-xl
              flex items-center gap-2
              transition-all duration-150
              ${isSaving
                ? 'opacity-50 cursor-not-allowed'
                : ''
              }
              ${isDark
                ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm shadow-white/5'
                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm shadow-gray-900/10'
              }
            `}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Speichern...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Speichern
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    globalThis.document.body
  );
}
