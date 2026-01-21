/**
 * DocumentContext - Document Management State
 *
 * Manages document state including:
 * - Document list loading and caching
 * - Upload progress and status
 * - Error handling and toast notifications
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
} from 'react';
import {
  fetchDocuments,
  uploadDocumentAsync,
  deleteDocument as apiDeleteDocument,
  bulkDeleteDocuments as apiBulkDeleteDocuments,
} from '../lib/api';
import { useToast } from './ToastContext';

export interface DocumentMetadata {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: 'pdf';
  uploadedAt: string;
  pages: number;
  text?: string;
}

export interface UploadProgress {
  progress: number; // 0-100
  loaded: number;   // bytes loaded
  total: number;    // total bytes
  phase: 'uploading' | 'processing';
}

export interface DocumentContextValue {
  // Document list state
  documents: DocumentMetadata[];
  isLoading: boolean;
  error: string | null;

  // Upload state
  isUploading: boolean;
  uploadProgress: UploadProgress | null;

  // Selection state (for bulk operations)
  selectedIds: Set<string>;
  isSelectionMode: boolean;

  // Actions
  refreshDocuments: () => Promise<void>;
  uploadPDF: (file: File) => Promise<DocumentMetadata | null>;
  deleteDocument: (id: string) => Promise<void>;
  bulkDeleteDocuments: (ids: string[]) => Promise<void>;

  // Selection actions
  toggleSelectionMode: () => void;
  toggleSelectDocument: (id: string) => void;
  selectAllDocuments: () => void;
  clearSelection: () => void;

  // Computed values
  totalDocuments: number;
  totalSize: number; // in bytes
  selectedCount: number;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

export interface DocumentProviderProps {
  children: ReactNode;
}

export function DocumentProvider({ children }: DocumentProviderProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const { addToast } = useToast();

  /**
   * Load documents from API
   */
  const refreshDocuments = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchDocuments();
      setDocuments(result.documents);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load documents';
      setError(errorMessage);
      addToast('error', 'Dokumente konnten nicht geladen werden', {
        title: 'Fehler beim Laden',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  /**
   * Upload a PDF file with progress tracking
   */
  const uploadPDF = useCallback(async (file: File): Promise<DocumentMetadata | null> => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      addToast('error', 'Nur PDF-Dateien sind erlaubt', {
        title: 'Ungültiger Dateityp',
      });
      return null;
    }

    // Validate file size (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      addToast('error', 'Maximum 50MB Dateigröße erlaubt', {
        title: 'Datei zu groß',
      });
      return null;
    }

    setIsUploading(true);
    setUploadProgress(null);

    try {
      // Use new async upload system with job-based processing
      const uploadResponse = await uploadDocumentAsync(file, (progress) => {
        setUploadProgress(progress);
      });

      addToast('success', `"${file.name}" wird verarbeitet. Sie sehen den Fortschritt in Echtzeit.`, {
        title: 'Upload gestartet',
      });

      // Return a placeholder document with the job info
      // The real document will be available once processing completes
      const placeholder: DocumentMetadata = {
        id: uploadResponse.documentId,
        filename: `processing_${uploadResponse.jobId}`,
        originalName: file.name,
        size: file.size,
        type: 'pdf',
        uploadedAt: new Date().toISOString(),
        pages: 0, // Will be updated when processing completes
      };

      return placeholder;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      addToast('error', errorMessage, {
        title: 'Upload fehlgeschlagen',
      });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [addToast]);

  /**
   * Delete a document
   */
  const deleteDocument = useCallback(async (id: string) => {
    const document = documents.find(d => d.id === id);

    try {
      await apiDeleteDocument(id);

      // Remove from state
      setDocuments(prev => prev.filter(d => d.id !== id));
      // Also remove from selection if selected
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      addToast('success', document ? `"${document.originalName}" wurde gelöscht` : 'Dokument wurde gelöscht', {
        title: 'Dokument gelöscht',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      addToast('error', errorMessage, {
        title: 'Löschen fehlgeschlagen',
      });
    }
  }, [documents, addToast]);

  /**
   * Bulk delete multiple documents
   */
  const bulkDeleteDocuments = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      const result = await apiBulkDeleteDocuments(ids);

      // Remove successfully deleted documents from state
      const deletedIds = new Set(result.results.filter(r => r.success).map(r => r.id));
      setDocuments(prev => prev.filter(d => !deletedIds.has(d.id)));

      // Clear selection
      setSelectedIds(new Set());
      setIsSelectionMode(false);

      if (result.success) {
        addToast('success', `${result.deletedCount} Dokument(e) erfolgreich gelöscht`, {
          title: 'Dokumente gelöscht',
        });
      } else {
        addToast('warning', result.message, {
          title: 'Teilweise gelöscht',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk delete failed';
      addToast('error', errorMessage, {
        title: 'Löschen fehlgeschlagen',
      });
    }
  }, [addToast]);

  /**
   * Toggle selection mode
   */
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) {
        // Exiting selection mode - clear selection
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  /**
   * Toggle document selection
   */
  const toggleSelectDocument = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Select all documents
   */
  const selectAllDocuments = useCallback(() => {
    setSelectedIds(new Set(documents.map(d => d.id)));
  }, [documents]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Load documents on mount
  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  // Computed values
  const totalDocuments = documents.length;
  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
  const selectedCount = selectedIds.size;

  const contextValue: DocumentContextValue = {
    documents,
    isLoading,
    error,
    isUploading,
    uploadProgress,
    selectedIds,
    isSelectionMode,
    refreshDocuments,
    uploadPDF,
    deleteDocument,
    bulkDeleteDocuments,
    toggleSelectionMode,
    toggleSelectDocument,
    selectAllDocuments,
    clearSelection,
    totalDocuments,
    totalSize,
    selectedCount,
  };

  return (
    <DocumentContext.Provider value={contextValue}>
      {children}
    </DocumentContext.Provider>
  );
}

/**
 * Hook to use document context
 */
export function useDocuments(): DocumentContextValue {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
}