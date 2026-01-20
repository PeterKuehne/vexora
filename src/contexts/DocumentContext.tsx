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

  // Actions
  refreshDocuments: () => Promise<void>;
  uploadPDF: (file: File) => Promise<DocumentMetadata | null>;
  deleteDocument: (id: string) => Promise<void>;

  // Computed values
  totalDocuments: number;
  totalSize: number; // in bytes
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

  // Load documents on mount
  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  // Computed values
  const totalDocuments = documents.length;
  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);

  const contextValue: DocumentContextValue = {
    documents,
    isLoading,
    error,
    isUploading,
    uploadProgress,
    refreshDocuments,
    uploadPDF,
    deleteDocument,
    totalDocuments,
    totalSize,
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