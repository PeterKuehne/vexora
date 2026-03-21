/**
 * DocumentUploadWithPermissions - Enhanced Multi-Format Upload Component with Permission System
 * RAG V2 Phase 2 - Supports PDF, DOCX, PPTX, XLSX, HTML, MD, TXT
 *
 * Features:
 * - Drag & drop area with refined styling
 * - File picker button
 * - Upload progress indicator
 * - Multi-format file validation (150MB max)
 * - Permission classification dropdown
 * - Visibility selection
 * - Permission preview
 * - TailwindCSS styling with theme support (MANDATORY)
 */

import { useCallback, useState, useRef } from 'react';
import { Upload, File, FileText, ArrowRight } from 'lucide-react';

// Supported file types (V2)
const SUPPORTED_TYPES: Record<string, { ext: string; name: string }> = {
  'application/pdf': { ext: 'pdf', name: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', name: 'Word' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', name: 'PowerPoint' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', name: 'Excel' },
  'text/html': { ext: 'html', name: 'HTML' },
  'text/markdown': { ext: 'md', name: 'Markdown' },
  'text/plain': { ext: 'txt', name: 'Text' },
};

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.md', '.markdown', '.txt'];
const ACCEPT_STRING = '.pdf,.docx,.pptx,.xlsx,.html,.htm,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,text/markdown,text/plain';

/**
 * Check if file is supported
 */
function isFileSupported(file: File): boolean {
  if (file.type && file.type in SUPPORTED_TYPES) {
    return true;
  }
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Get file type display name
 */
function getFileTypeName(file: File): string {
  if (file.type && SUPPORTED_TYPES[file.type]) {
    return SUPPORTED_TYPES[file.type].name;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ext.toUpperCase() + '-Dokument';
}
import { useTheme } from '../contexts/ThemeContext';
import { useProcessing } from '../hooks/useProcessing';
import { ProcessingProgress } from './ProcessingProgress';
import { ClassificationDropdown, type ClassificationLevel } from './ClassificationDropdown';
import { VisibilitySelector, type VisibilityType } from './VisibilitySelector';
import { PermissionPreview } from './PermissionPreview';
import { uploadDocumentWithPermissions, validateFileUpload, formatBytes, type DocumentPermissions } from '../lib/api';

interface DocumentPermissionState {
  classification: ClassificationLevel;
  visibility: VisibilityType;
  specificUsers: string[];
}

interface DocumentUploadWithPermissionsProps {
  onUploadComplete?: () => void;
}

export function DocumentUploadWithPermissions({ onUploadComplete }: DocumentUploadWithPermissionsProps = {}) {
  const { isDark } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const { jobs } = useProcessing();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permission state
  const [permissions, setPermissions] = useState<DocumentPermissionState>({
    classification: 'internal',
    visibility: 'department',
    specificUsers: []
  });

  // Get active processing jobs
  const activeJobs = jobs.filter(job =>
    job.status === 'pending' || job.status === 'processing'
  );

  // Get recent completed/failed jobs (last 5)
  const recentJobs = jobs
    .filter(job => job.status === 'completed' || job.status === 'failed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const handleFileSelection = useCallback(async (file: File) => {
    if (!isFileSupported(file)) {
      alert('Nicht unterstütztes Dateiformat. Erlaubt: PDF, Word, PowerPoint, Excel, HTML, Markdown, Text');
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      alert('Maximum 150MB Dateigröße erlaubt');
      return;
    }

    try {
      const quotaValidation = await validateFileUpload(file.size);
      if (!quotaValidation.allowed) {
        alert(`Upload nicht möglich: ${quotaValidation.reason}\n\nIhr aktueller Verbrauch: ${formatBytes(quotaValidation.currentUsage.usedBytes)} / ${formatBytes(quotaValidation.currentUsage.limitBytes)}`);
        return;
      }

      if (quotaValidation.currentUsage.isWarning) {
        const proceed = confirm(
          `Warnung: Ihr Speicher wird knapp!\n\n` +
          `Aktueller Verbrauch: ${quotaValidation.currentUsage.usagePercent.toFixed(1)}%\n` +
          `Nach dem Upload: ${formatBytes(quotaValidation.currentUsage.usedBytes + file.size)} / ${formatBytes(quotaValidation.currentUsage.limitBytes)}\n\n` +
          `Möchten Sie trotzdem fortfahren?`
        );
        if (!proceed) {
          return;
        }
      }
    } catch (error) {
      console.error('Quota validation failed:', error);
      alert(`Quota-Validierung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
      return;
    }

    setSelectedFile(file);
    setShowPermissions(true);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const supportedFile = files.find(file => isFileSupported(file));

    if (supportedFile) {
      handleFileSelection(supportedFile);
    }
  }, [handleFileSelection]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [handleFileSelection]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadWithPermissions = useCallback(async () => {
    if (!selectedFile) return;

    if (onUploadComplete) {
      onUploadComplete();
    } else {
      setIsUploading(true);
    }

    try {
      const apiPermissions: DocumentPermissions = {
        classification: permissions.classification,
        visibility: permissions.visibility,
        specificUsers: permissions.specificUsers
      };

      const response = await uploadDocumentWithPermissions(
        selectedFile,
        apiPermissions,
        (progress) => {
          console.log('Upload progress:', progress);
        }
      );

      console.log('Upload initiated:', response);

      if (!onUploadComplete) {
        setIsUploading(false);
        setSelectedFile(null);
        setShowPermissions(false);
        setPermissions({
          classification: 'internal',
          visibility: 'department',
          specificUsers: []
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
      if (!onUploadComplete) {
        setIsUploading(false);
      }
    }
  }, [selectedFile, permissions, onUploadComplete]);

  const handleCancel = useCallback(() => {
    setSelectedFile(null);
    setShowPermissions(false);
    setPermissions({
      classification: 'internal',
      visibility: 'department',
      specificUsers: []
    });
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Upload progress display
  if (isUploading) {
    return (
      <div
        className={`
          p-8 rounded-2xl
          ${isDark
            ? 'bg-white/[0.02] border border-white/[0.06]'
            : 'bg-gray-50 border border-gray-200/80'
          }
        `}
      >
        <div className="text-center">
          <div className={`
            inline-flex p-4 rounded-2xl mb-4
            ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}
          `}>
            <Upload className={`w-8 h-8 animate-pulse ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
          </div>

          <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Dokument wird hochgeladen...
          </h3>

          {/* Progress Bar */}
          <div className={`
            w-full max-w-xs mx-auto h-1.5 rounded-full mb-3 overflow-hidden
            ${isDark ? 'bg-white/5' : 'bg-gray-200'}
          `}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 animate-pulse"
              style={{ width: '60%' }}
            />
          </div>

          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Upload läuft...
          </p>
        </div>
      </div>
    );
  }

  // Permission configuration view
  if (showPermissions && selectedFile) {
    return (
      <div className="space-y-5">
        {/* File Info */}
        <div
          className={`
            flex items-center justify-between p-4 rounded-xl
            ${isDark
              ? 'bg-white/[0.03] border border-white/[0.06]'
              : 'bg-gray-50 border border-gray-200/80'
            }
          `}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`
              p-2 rounded-lg shrink-0
              ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}
            `}>
              <FileText className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {selectedFile.name}
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {formatFileSize(selectedFile.size)} · {getFileTypeName(selectedFile)}
              </div>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className={`
              text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 transition-colors
              ${isDark
                ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            Abbrechen
          </button>
        </div>

        {/* Permission Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <ClassificationDropdown
              value={permissions.classification}
              onChange={(classification) =>
                setPermissions(prev => ({ ...prev, classification }))
              }
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
            />
          </div>

          <div>
            <PermissionPreview
              classification={permissions.classification}
              visibility={permissions.visibility}
              specificUsers={permissions.specificUsers}
            />
          </div>
        </div>

        {/* Upload Actions */}
        <div className={`
          flex justify-end gap-2.5 pt-4 border-t
          ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}
        `}>
          <button
            onClick={handleCancel}
            className={`
              px-4 py-2 text-sm font-medium rounded-xl transition-colors
              ${isDark
                ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            Abbrechen
          </button>

          <button
            onClick={handleUploadWithPermissions}
            disabled={isUploading}
            className={`
              group px-5 py-2 text-sm font-semibold rounded-xl
              flex items-center gap-2 transition-all
              ${isUploading
                ? 'opacity-50 cursor-not-allowed'
                : ''
              }
              ${isDark
                ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm shadow-white/5'
                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm shadow-gray-900/10'
              }
            `}
          >
            {isUploading ? 'Wird hochgeladen...' : 'Hochladen'}
            {!isUploading && <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />}
          </button>
        </div>
      </div>
    );
  }

  // Default upload zone
  return (
    <div>
      {/* Hidden file input */}
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
          relative p-8 rounded-2xl cursor-pointer
          transition-all duration-200 group
          ${isDragOver
            ? isDark
              ? 'bg-blue-500/8 border-2 border-dashed border-blue-400/50'
              : 'bg-blue-50/80 border-2 border-dashed border-blue-300'
            : isDark
              ? 'bg-white/[0.02] border-2 border-dashed border-white/[0.08] hover:border-white/15 hover:bg-white/[0.03]'
              : 'bg-gray-50/50 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }
        `}
        onClick={handleButtonClick}
      >
        <div className="text-center">
          <div className={`
            inline-flex p-4 rounded-2xl mb-4 transition-colors
            ${isDragOver
              ? isDark ? 'bg-blue-500/10' : 'bg-blue-100'
              : isDark ? 'bg-white/[0.03]' : 'bg-gray-100'
            }
          `}>
            <Upload
              className={`w-7 h-7 transition-all duration-200 ${
                isDragOver
                  ? isDark ? 'text-blue-400' : 'text-blue-500'
                  : isDark
                    ? 'text-gray-600 group-hover:text-gray-500'
                    : 'text-gray-300 group-hover:text-gray-400'
              }`}
            />
          </div>

          <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Dokument mit Berechtigungen hochladen
          </h3>

          <p className={`text-xs mb-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Ziehen Sie eine Datei hierher oder klicken Sie zum Auswählen
          </p>

          <button
            className={`
              px-5 py-2 rounded-xl text-sm font-semibold transition-all
              ${isDark
                ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm shadow-white/5'
                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm shadow-gray-900/10'
              }
            `}
            onClick={(e) => {
              e.stopPropagation();
              handleButtonClick();
            }}
          >
            Datei auswählen
          </button>

          <p className={`text-[11px] mt-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
            Max 150MB · PDF, Word, PowerPoint, Excel, HTML, Markdown, Text
          </p>
        </div>

        {/* Active Processing Jobs */}
        {activeJobs.length > 0 && (
          <div className="mt-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
          <div className="mt-6 space-y-2" onClick={(e) => e.stopPropagation()}>
            <h4 className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
