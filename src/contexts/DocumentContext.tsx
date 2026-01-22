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
  useRef,
} from 'react';
import {
  fetchDocuments,
  uploadDocumentAsync,
  deleteDocument as apiDeleteDocument,
  bulkDeleteDocuments as apiBulkDeleteDocuments,
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
  type DocumentMetadata,
} from '../lib/api';
import { useToast } from './ToastContext';
import { useProcessing } from '../hooks/useProcessing';
import { useSocket } from '../hooks/useSocket';
import type {
  ProcessingJob,
  DocumentUploadedEvent,
  DocumentDeletedEvent,
  DocumentUpdatedEvent,
  DocumentPermissionsChangedEvent,
  DocumentsBulkDeletedEvent
} from '../lib/socket';

// Re-export types and constants from api.ts for consumers
export { DOCUMENT_CATEGORIES };
export type { DocumentCategory, DocumentMetadata };

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

  // Track completed jobs to avoid duplicate refreshes
  const processedJobIds = useRef<Set<string>>(new Set());

  const { addToast } = useToast();
  const { addJob, jobs } = useProcessing();

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

  // Real-time document event handlers
  const handleDocumentUploaded = useCallback((event: DocumentUploadedEvent) => {
    console.log('📤 Real-time: Document uploaded', event);

    // Add document to state if not already present
    setDocuments(prevDocs => {
      const exists = prevDocs.some(doc => doc.id === event.document.id);
      if (!exists) {
        const newDoc: DocumentMetadata = {
          id: event.document.id,
          filename: event.document.filename,
          originalName: event.document.originalName,
          size: event.document.size,
          type: 'pdf',
          uploadedAt: event.document.createdAt,
          pages: 0, // Will be updated when available
          category: (event.document.category as DocumentCategory) || 'Allgemein',
          tags: event.document.tags
        };
        return [newDoc, ...prevDocs]; // Add to beginning for newest first
      }
      return prevDocs;
    });

    // Show notification
    addToast('success', `Dokument "${event.document.originalName}" wurde hochgeladen`, {
      title: 'Neues Dokument'
    });
  }, [addToast]);

  const handleDocumentDeleted = useCallback((event: DocumentDeletedEvent) => {
    console.log('🗑️ Real-time: Document deleted', event);

    // Remove document from state
    setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== event.document.id));

    // Remove from selection if selected
    setSelectedIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      newSelected.delete(event.document.id);
      return newSelected;
    });

    // Show notification
    addToast('info', `Dokument "${event.document.originalName}" wurde gelöscht`, {
      title: 'Dokument entfernt'
    });
  }, [addToast]);

  const handleDocumentUpdated = useCallback((event: DocumentUpdatedEvent) => {
    console.log('✏️ Real-time: Document updated', event);

    // Update document in state
    setDocuments(prevDocs =>
      prevDocs.map(doc =>
        doc.id === event.document.id
          ? {
              ...doc,
              category: (event.document.category as DocumentCategory) || doc.category,
              tags: event.document.tags,
              updatedAt: event.timestamp
            }
          : doc
      )
    );

    // Show notification
    addToast('success', `Dokument "${event.document.originalName}" wurde aktualisiert`, {
      title: 'Dokument geändert'
    });
  }, [addToast]);

  const handleDocumentPermissionsChanged = useCallback((event: DocumentPermissionsChangedEvent) => {
    console.log('🔐 Real-time: Document permissions changed', event);

    // For now, refresh documents to get updated permissions
    // In a more sophisticated implementation, we'd update the specific document
    refreshDocuments();

    // Show notification
    addToast('info', `Berechtigungen für "${event.document.originalName}" wurden geändert`, {
      title: 'Berechtigungen aktualisiert'
    });
  }, [addToast, refreshDocuments]);

  const handleDocumentsBulkDeleted = useCallback((event: DocumentsBulkDeletedEvent) => {
    console.log('🗑️ Real-time: Documents bulk deleted', event);

    // Remove all deleted documents from state
    const deletedIds = new Set(event.documents.map(doc => doc.id));
    setDocuments(prevDocs => prevDocs.filter(doc => !deletedIds.has(doc.id)));

    // Remove from selection if selected
    setSelectedIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      deletedIds.forEach(id => newSelected.delete(id));
      return newSelected;
    });

    // Show notification
    addToast('info', `${event.documents.length} Dokument(e) wurden gelöscht`, {
      title: 'Dokumente entfernt'
    });
  }, [addToast]);

  // Socket connection with document event handlers
  useSocket({
    autoConnect: true,
    onDocumentUploaded: handleDocumentUploaded,
    onDocumentDeleted: handleDocumentDeleted,
    onDocumentUpdated: handleDocumentUpdated,
    onDocumentPermissionsChanged: handleDocumentPermissionsChanged,
    onDocumentsBulkDeleted: handleDocumentsBulkDeleted
  });

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

      // Add job to processing list BEFORE Socket.io events arrive
      const initialJob: ProcessingJob = {
        id: uploadResponse.jobId,
        documentId: uploadResponse.documentId,
        documentName: file.name,
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      };
      addJob(initialJob);

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
        category: 'Allgemein',
        tags: [],
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
  }, [addToast, addJob]);

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

  // Refresh documents when a processing job completes
  useEffect(() => {
    const completedJobs = jobs.filter(job => job.status === 'completed');

    // Find newly completed jobs that we haven't processed yet
    const newCompletedJobs = completedJobs.filter(
      job => !processedJobIds.current.has(job.id)
    );

    if (newCompletedJobs.length > 0) {
      // Mark these jobs as processed
      newCompletedJobs.forEach(job => {
        processedJobIds.current.add(job.id);
      });

      // Refresh the document list
      refreshDocuments();
    }
  }, [jobs, refreshDocuments]);

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