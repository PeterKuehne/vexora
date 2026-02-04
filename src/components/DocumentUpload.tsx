/**
 * DocumentUpload - Multi-Format Document Upload Component
 * RAG V2 Phase 2 - Supports PDF, DOCX, PPTX, XLSX, HTML, MD, TXT
 *
 * Features:
 * - Drag & drop area
 * - File picker button
 * - Upload progress indicator
 * - Multi-format file validation (150MB max)
 * - Visual feedback during upload
 */

import { useCallback, useState, useRef } from 'react';
import { Upload, File, FileText, FileSpreadsheet, Presentation, FileCode } from 'lucide-react';

// Supported file types (V2)
const SUPPORTED_TYPES = {
  'application/pdf': { ext: 'pdf', name: 'PDF', icon: File },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', name: 'Word', icon: FileText },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', name: 'PowerPoint', icon: Presentation },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', name: 'Excel', icon: FileSpreadsheet },
  'text/html': { ext: 'html', name: 'HTML', icon: FileCode },
  'text/markdown': { ext: 'md', name: 'Markdown', icon: FileText },
  'text/plain': { ext: 'txt', name: 'Text', icon: FileText },
};

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.md', '.markdown', '.txt'];
const ACCEPT_STRING = '.pdf,.docx,.pptx,.xlsx,.html,.htm,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,text/markdown,text/plain';

/**
 * Check if file is supported
 */
function isFileSupported(file: File): boolean {
  // Check MIME type
  if (file.type && file.type in SUPPORTED_TYPES) {
    return true;
  }

  // Check extension
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { useProcessing } from '../hooks/useProcessing';
import { ProcessingProgress } from './ProcessingProgress';

export function DocumentUpload() {
  const { isDark } = useTheme();
  const { uploadPDF, isUploading, uploadProgress } = useDocuments();
  const { jobs } = useProcessing();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get active processing jobs
  const activeJobs = jobs.filter(job =>
    job.status === 'pending' || job.status === 'processing'
  );

  // Get recent completed/failed jobs (last 5)
  const recentJobs = jobs
    .filter(job => job.status === 'completed' || job.status === 'failed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  /**
   * Handle file drop (V2 - multi-format)
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const supportedFile = files.find(file => isFileSupported(file));

    if (supportedFile) {
      uploadPDF(supportedFile);
    }
  }, [uploadPDF]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPDF(file);
      // Reset input to allow same file upload again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadPDF]);

  /**
   * Handle drag events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set drag over to false if leaving the component entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  /**
   * Trigger file picker
   */
  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Upload progress display
  if (isUploading && uploadProgress) {
    const { progress, loaded, total, phase } = uploadProgress;

    return (
      <div
        className={`
          p-6 border-2 border-dashed rounded-lg
          ${isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50/50'}
        `}
      >
        <div className="text-center">
          <div className="mb-4">
            {phase === 'uploading' ? (
              <Upload
                className={`w-12 h-12 mx-auto animate-pulse ${
                  isDark ? 'text-blue-400' : 'text-blue-500'
                }`}
              />
            ) : (
              <File
                className={`w-12 h-12 mx-auto animate-pulse ${
                  isDark ? 'text-yellow-400' : 'text-yellow-500'
                }`}
              />
            )}
          </div>

          <h3
            className={`text-lg font-medium mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-800'
            }`}
          >
            {phase === 'uploading' ? 'Hochladen...' : 'Verarbeitung...'}
          </h3>

          {/* Progress Bar */}
          <div
            className={`w-full h-2 rounded-full mb-2 ${
              isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                phase === 'uploading'
                  ? 'bg-blue-500'
                  : 'bg-yellow-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <p
            className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {formatFileSize(loaded)} von {formatFileSize(total)} ({progress}%)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hidden file input (V2 - multi-format) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          p-8 border-2 border-dashed rounded-lg cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? isDark
              ? 'border-blue-400 bg-blue-900/20'
              : 'border-blue-500 bg-blue-50'
            : isDark
              ? 'border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50'
              : 'border-gray-300 bg-gray-50/50 hover:border-gray-400 hover:bg-gray-100'
          }
        `}
        onClick={handleButtonClick}
      >
        <div className="text-center">
          <Upload
            className={`w-12 h-12 mx-auto mb-4 ${
              isDragOver
                ? isDark
                  ? 'text-blue-400'
                  : 'text-blue-500'
                : isDark
                  ? 'text-gray-500'
                  : 'text-gray-400'
            }`}
          />

          <h3
            className={`text-lg font-medium mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-800'
            }`}
          >
            Dokument hochladen
          </h3>

          <p
            className={`text-sm mb-4 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Ziehen Sie eine Datei hierher oder klicken Sie zum Auswählen
          </p>

          <button
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
            `}
            onClick={(e) => {
              e.stopPropagation();
              handleButtonClick();
            }}
          >
            Datei auswählen
          </button>

          <p
            className={`text-xs mt-3 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            Maximal 150MB • PDF, Word, PowerPoint, Excel, HTML, Markdown, Text
          </p>
        </div>

        {/* Active Processing Jobs */}
        {activeJobs.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Verarbeitung läuft...
            </h4>
            {activeJobs.map((job) => (
              <ProcessingProgress
                key={job.id}
                job={job}
                className="transition-all duration-300 ease-in-out"
              />
            ))}
          </div>
        )}

        {/* Recent Completed/Failed Jobs */}
        {recentJobs.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Letzte Aktivität
            </h4>
            {recentJobs.map((job) => (
              <ProcessingProgress
                key={job.id}
                job={job}
                className="opacity-80 transition-all duration-300 ease-in-out"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}