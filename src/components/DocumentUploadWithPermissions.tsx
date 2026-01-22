/**
 * DocumentUploadWithPermissions - Enhanced PDF Upload Component with Permission System
 *
 * Features:
 * - Drag & drop area
 * - File picker button
 * - Upload progress indicator
 * - File validation (PDF only, 50MB max)
 * - Permission classification dropdown
 * - Visibility selection
 * - Permission preview
 * - TailwindCSS styling with theme support (MANDATORY)
 */

import { useCallback, useState, useRef } from 'react';
import { Upload, File, Settings, ChevronRight } from 'lucide-react';
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

export function DocumentUploadWithPermissions() {
  const { isDark } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const { jobs } = useProcessing();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permission state
  const [permissions, setPermissions] = useState<DocumentPermissionState>({
    classification: 'internal', // Default to internal
    visibility: 'department',   // Default to department
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

  /**
   * Handle file selection (drag & drop or file picker)
   */
  const handleFileSelection = useCallback(async (file: File) => {
    // Basic validation
    if (file.type !== 'application/pdf') {
      alert('Nur PDF-Dateien sind erlaubt');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Maximum 50MB Dateigröße erlaubt');
      return;
    }

    // Quota validation
    try {
      const quotaValidation = await validateFileUpload(file.size);
      if (!quotaValidation.allowed) {
        alert(`Upload nicht möglich: ${quotaValidation.reason}\n\nIhr aktueller Verbrauch: ${formatBytes(quotaValidation.currentUsage.usedBytes)} / ${formatBytes(quotaValidation.currentUsage.limitBytes)}`);
        return;
      }

      // Show warning if quota is getting low
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

  /**
   * Handle file drop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');

    if (pdfFile) {
      handleFileSelection(pdfFile);
    }
  }, [handleFileSelection]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
      // Reset input to allow same file upload again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [handleFileSelection]);

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
   * Handle upload with permissions
   */
  const handleUploadWithPermissions = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      // Use the new API with permissions
      const apiPermissions: DocumentPermissions = {
        classification: permissions.classification,
        visibility: permissions.visibility,
        specificUsers: permissions.specificUsers
      };

      const response = await uploadDocumentWithPermissions(
        selectedFile,
        apiPermissions,
        (progress) => {
          // Handle upload progress here if needed
          console.log('Upload progress:', progress);
        }
      );

      console.log('Upload initiated:', response);

      // Reset state
      setSelectedFile(null);
      setShowPermissions(false);
      setPermissions({
        classification: 'internal',
        visibility: 'department',
        specificUsers: []
      });
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, permissions]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    setSelectedFile(null);
    setShowPermissions(false);
    setPermissions({
      classification: 'internal',
      visibility: 'department',
      specificUsers: []
    });
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
  if (isUploading) {

    return (
      <div
        className={`
          p-6 border-2 border-dashed rounded-lg
          ${isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50/50'}
        `}
      >
        <div className="text-center">
          <div className="mb-4">
            <Upload
              className={`w-12 h-12 mx-auto animate-pulse ${
                isDark ? 'text-blue-400' : 'text-blue-500'
              }`}
            />
          </div>

          <h3
            className={`text-lg font-medium mb-2 ${
              isDark ? 'text-gray-200' : 'text-gray-800'
            }`}
          >
            Dokument wird hochgeladen...
          </h3>

          {/* Progress Bar */}
          <div
            className={`w-full h-2 rounded-full mb-2 ${
              isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <div
              className="h-full rounded-full bg-blue-500 animate-pulse"
              style={{ width: '50%' }}
            />
          </div>

          <p
            className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Upload läuft...
          </p>
        </div>
      </div>
    );
  }

  // Permission configuration view
  if (showPermissions && selectedFile) {
    return (
      <div className="space-y-6">
        {/* File Info */}
        <div
          className={`
            p-4 border rounded-lg
            ${isDark
              ? 'border-gray-600 bg-gray-800/30'
              : 'border-gray-300 bg-gray-50/50'
            }
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <File
                className={`
                  w-8 h-8 mr-3
                  ${isDark ? 'text-blue-400' : 'text-blue-500'}
                `}
              />
              <div>
                <div
                  className={`
                    font-medium
                    ${isDark ? 'text-gray-200' : 'text-gray-800'}
                  `}
                >
                  {selectedFile.name}
                </div>
                <div
                  className={`
                    text-sm
                    ${isDark ? 'text-gray-400' : 'text-gray-600'}
                  `}
                >
                  {formatFileSize(selectedFile.size)} • PDF-Dokument
                </div>
              </div>
            </div>

            <button
              onClick={handleCancel}
              className={`
                px-3 py-1.5 text-sm rounded
                transition-colors duration-150
                ${isDark
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              Abbrechen
            </button>
          </div>
        </div>

        {/* Permission Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Classification Dropdown */}
            <ClassificationDropdown
              value={permissions.classification}
              onChange={(classification) =>
                setPermissions(prev => ({ ...prev, classification }))
              }
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
            />
          </div>

          <div>
            {/* Permission Preview */}
            <PermissionPreview
              classification={permissions.classification}
              visibility={permissions.visibility}
              specificUsers={permissions.specificUsers}
            />
          </div>
        </div>

        {/* Upload Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={handleCancel}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg
              transition-colors duration-150
              ${isDark
                ? 'text-gray-300 border border-gray-600 hover:bg-gray-700'
                : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            Abbrechen
          </button>

          <button
            onClick={handleUploadWithPermissions}
            disabled={isUploading}
            className={`
              px-6 py-2 text-sm font-medium rounded-lg
              transition-colors duration-150
              ${isUploading
                ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                : isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }
            `}
          >
            {isUploading ? 'Wird hochgeladen...' : 'Hochladen'}
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
        accept="application/pdf,.pdf"
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
            PDF-Dokument mit Berechtigungen hochladen
          </h3>

          <p
            className={`text-sm mb-4 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Ziehen Sie eine PDF-Datei hierher oder klicken Sie zum Auswählen
          </p>

          <div className="flex items-center justify-center gap-2 mb-4">
            <Settings
              className={`
                w-4 h-4
                ${isDark ? 'text-blue-400' : 'text-blue-600'}
              `}
            />
            <span
              className={`
                text-sm font-medium
                ${isDark ? 'text-blue-400' : 'text-blue-600'}
              `}
            >
              Klassifizierung & Berechtigungen konfigurieren
            </span>
            <ChevronRight
              className={`
                w-4 h-4
                ${isDark ? 'text-blue-400' : 'text-blue-600'}
              `}
            />
          </div>

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
            Maximal 50MB • Nur PDF-Dateien
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