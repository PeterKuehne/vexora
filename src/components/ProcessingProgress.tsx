import { type ProcessingJob } from '../lib/socket'
import { useMemo } from 'react'

interface ProcessingProgressProps {
  job: ProcessingJob
  className?: string
}

/**
 * ProcessingProgress - Shows real-time processing progress with chunk status
 * Displays progress bar and status information for document processing
 */
export function ProcessingProgress({ job, className = '' }: ProcessingProgressProps) {
  // Get status information
  const statusInfo = useMemo(() => {
    const { status, currentChunk, totalChunks, error } = job

    switch (status) {
      case 'pending':
        return {
          label: 'Warten auf Verarbeitung...',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          showProgress: false,
        }

      case 'processing':
        const chunkInfo = currentChunk && totalChunks
          ? ` (Schritt ${currentChunk}/${totalChunks})`
          : ''
        return {
          label: `Verarbeitung läuft... ${chunkInfo}`,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          showProgress: true,
          progressColor: 'bg-yellow-500',
        }

      case 'completed':
        return {
          label: 'Erfolgreich verarbeitet',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          showProgress: false,
        }

      case 'failed':
        return {
          label: `Fehler: ${error || 'Unbekannter Fehler'}`,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          showProgress: false,
        }

      default:
        return {
          label: 'Unbekannter Status',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          showProgress: false,
        }
    }
  }, [job])

  return (
    <div className={`rounded-lg p-3 ${statusInfo.bgColor} ${className}`}>
      {/* Status Label */}
      <div className={`text-sm font-medium ${statusInfo.color} mb-2`}>
        {statusInfo.label}
      </div>

      {/* Progress Bar */}
      {statusInfo.showProgress && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${statusInfo.progressColor || 'bg-blue-500'}`}
            style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
          />
        </div>
      )}

      {/* Progress Text */}
      {statusInfo.showProgress && (
        <div className={`text-xs ${statusInfo.color} mt-1 text-right`}>
          {job.progress}% abgeschlossen
        </div>
      )}

      {/* Timing Information */}
      {(job.status === 'processing' || job.status === 'completed' || job.status === 'failed') && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Datei: {job.originalName}
        </div>
      )}
    </div>
  )
}

interface ProcessingStatusIconProps {
  status: ProcessingJob['status']
  size?: 'sm' | 'md' | 'lg'
}

/**
 * ProcessingStatusIcon - Compact status icon for inline display
 */
export function ProcessingStatusIcon({ status, size = 'sm' }: ProcessingStatusIconProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const iconClass = `${sizeClasses[size]} animate-pulse`

  switch (status) {
    case 'pending':
      return (
        <div className={`${iconClass} bg-blue-500 rounded-full opacity-60`} title="Wartet auf Verarbeitung" />
      )

    case 'processing':
      return (
        <div className={`${iconClass} border-2 border-yellow-500 border-t-transparent rounded-full animate-spin`} title="Wird verarbeitet" />
      )

    case 'completed':
      return (
        <svg className={`${sizeClasses[size]} text-green-500`} viewBox="0 0 20 20" fill="currentColor">
          <title>Abgeschlossen</title>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )

    case 'failed':
      return (
        <svg className={`${sizeClasses[size]} text-red-500`} viewBox="0 0 20 20" fill="currentColor">
          <title>Fehler</title>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )

    default:
      return (
        <div className={`${iconClass} bg-gray-400 rounded-full`} title="Unbekannter Status" />
      )
  }
}