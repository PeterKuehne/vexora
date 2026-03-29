/**
 * DocumentPreview — Full-screen modal to display document content
 *
 * Uses React Portal to render outside parent DOM hierarchy.
 * Fetches content from /api/documents/:id/content and renders
 * Markdown as formatted text.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { httpClient } from '../lib/httpClient';
import { env } from '../lib/env';
import { cn } from '../utils';
import type { DocumentMetadata } from '../contexts/DocumentContext';

interface DocumentPreviewProps {
  document: DocumentMetadata;
  onClose: () => void;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  public: 'bg-emerald-100 text-emerald-700',
  internal: 'bg-blue-100 text-blue-700',
  confidential: 'bg-amber-100 text-amber-700',
  restricted: 'bg-red-100 text-red-700',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  public: 'Öffentlich',
  internal: 'Intern',
  confidential: 'Vertraulich',
  restricted: 'Streng vertraulich',
};

function DocumentPreviewModal({ document, onClose }: DocumentPreviewProps) {
  const { isDark } = useTheme();
  const [content, setContent] = useState<string>('');
  const [chunks, setChunks] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const isPdf = document.originalName?.endsWith('.pdf') || document.filename?.endsWith('.pdf');

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (isPdf) {
      // For PDFs: try to load original file for native browser preview
      httpClient.get(`${env.API_URL}/api/documents/${document.id}/file`)
        .then(r => {
          if (r.ok) return r.blob();
          throw new Error('Original nicht verfügbar');
        })
        .then(blob => {
          setFileUrl(URL.createObjectURL(blob));
          setLoading(false);
        })
        .catch(() => {
          // Fallback: load text content from Weaviate chunks
          loadTextContent();
        });
    } else {
      loadTextContent();
    }

    function loadTextContent() {
      httpClient.get(`${env.API_URL}/api/documents/${document.id}/content`)
        .then(r => r.json())
        .then(data => {
          setContent(data.content || '');
          setChunks(data.chunks || 0);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Fehler beim Laden des Inhalts');
          setLoading(false);
        });
    }

    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [document.id]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body?.classList?.add?.('overflow-hidden');
    return () => document.body?.classList?.remove?.('overflow-hidden');
  }, []);

  const classification = document.metadata?.classification || 'internal';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Backdrop — fixed fullscreen */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 99998,
        }}
      />

      {/* Modal — fixed fullscreen centered */}
      <div
        style={{
          position: 'fixed',
          top: '3vh',
          left: '3vw',
          right: '3vw',
          bottom: '3vh',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <FileText size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
            <div>
              <h2 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: isDark ? '#fff' : '#111',
                margin: 0,
              }}>
                {document.originalName || document.filename}
              </h2>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>
                <span>{formatSize(document.size)}</span>
                <span>{document.pages} Seiten</span>
                <span>{chunks} Chunks</span>
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', CLASSIFICATION_COLORS[classification])}>
                  {CLASSIFICATION_LABELS[classification] || classification}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            color: isDark ? '#e5e7eb' : '#374151',
            fontSize: '14px',
            lineHeight: '1.7',
          }}
        >
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#d1d5db' }} />
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#ef4444' }}>
              {error}
            </div>
          )}

          {!loading && !error && !content && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af' }}>
              Kein Inhalt verfügbar. Das Dokument wurde möglicherweise noch nicht indexiert.
            </div>
          )}

          {!loading && !error && fileUrl && (
            <iframe
              src={fileUrl}
              style={{ width: '100%', height: '100%', border: 'none', minHeight: '70vh' }}
              title={document.originalName || document.filename}
            />
          )}

          {!loading && !error && !fileUrl && content && (
            <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif' }}>
              {content}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DocumentPreview({ document, onClose }: DocumentPreviewProps) {
  // Render via Portal directly into document.body to escape any parent overflow/z-index
  return createPortal(
    <DocumentPreviewModal document={document} onClose={onClose} />,
    window.document.body
  );
}
