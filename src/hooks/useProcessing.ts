import { useState, useEffect, useCallback } from 'react'
import {
  type ProcessingJob,
  type ProcessingEvent,
  type ActiveJobsPayload,
  onProcessingUpdate,
  onActiveJobs,
  connectSocket
} from '../lib/socket'

interface UseProcessingReturn {
  jobs: ProcessingJob[]
  getJobByDocumentId: (documentId: string) => ProcessingJob | undefined
  getJobById: (jobId: string) => ProcessingJob | undefined
  isProcessing: (documentId?: string) => boolean
  getProgress: (documentId: string) => number | undefined
}

/**
 * Hook for managing document processing status
 * Connects to Socket.io for real-time updates
 */
export function useProcessing(): UseProcessingReturn {
  const [jobs, setJobs] = useState<ProcessingJob[]>([])

  // Handle processing updates from server
  const handleProcessingUpdate = useCallback((event: ProcessingEvent) => {
    console.log(`📋 Processing update received:`, event)

    setJobs(prev => {
      const existing = prev.find(job => job.id === event.jobId)

      if (existing) {
        // Update existing job
        return prev.map(job => {
          if (job.id === event.jobId) {
            const updated: ProcessingJob = {
              ...job,
              status: event.data.status,
              progress: event.data.progress,
            };

            if (event.data.error !== undefined) {
              updated.error = event.data.error;
            }

            if (event.data.currentChunk !== undefined) {
              updated.currentChunk = event.data.currentChunk;
            }

            if (event.data.totalChunks !== undefined) {
              updated.totalChunks = event.data.totalChunks;
            }

            if (event.data.status === 'processing' && !job.startedAt) {
              updated.startedAt = event.data.timestamp;
            }

            if (event.data.status === 'completed' || event.data.status === 'failed') {
              updated.completedAt = event.data.timestamp;
            }

            return updated;
          }
          return job;
        })
      } else {
        // If job doesn't exist yet, this might be from a previous session
        // We'll wait for the active_jobs event to get the full job data
        console.warn(`Received update for unknown job ${event.jobId}`)
        return prev
      }
    })
  }, [])

  // Handle active jobs list from server
  const handleActiveJobs = useCallback((data: ActiveJobsPayload) => {
    console.log(`📋 Active jobs received:`, data.jobs.length, 'jobs')
    setJobs(prev => {
      // Merge with existing jobs, prioritizing server data for active jobs
      const serverJobIds = new Set(data.jobs.map(job => job.id))
      const existingNonActiveJobs = prev.filter(job => !serverJobIds.has(job.id))

      return [...data.jobs, ...existingNonActiveJobs]
    })
  }, [])

  // Set up socket listeners
  useEffect(() => {
    // Connect to socket if not already connected
    connectSocket()

    const unsubscribeUpdate = onProcessingUpdate(handleProcessingUpdate)
    const unsubscribeActiveJobs = onActiveJobs(handleActiveJobs)

    return () => {
      unsubscribeUpdate()
      unsubscribeActiveJobs()
    }
  }, [handleProcessingUpdate, handleActiveJobs])

  // Helper functions
  const getJobByDocumentId = useCallback((documentId: string): ProcessingJob | undefined => {
    return jobs.find(job => job.documentId === documentId)
  }, [jobs])

  const getJobById = useCallback((jobId: string): ProcessingJob | undefined => {
    return jobs.find(job => job.id === jobId)
  }, [jobs])

  const isProcessing = useCallback((documentId?: string): boolean => {
    if (documentId) {
      const job = getJobByDocumentId(documentId)
      return job?.status === 'pending' || job?.status === 'processing'
    }

    // Check if any job is processing
    return jobs.some(job => job.status === 'pending' || job.status === 'processing')
  }, [jobs, getJobByDocumentId])

  const getProgress = useCallback((documentId: string): number | undefined => {
    const job = getJobByDocumentId(documentId)
    return job?.progress
  }, [getJobByDocumentId])

  return {
    jobs,
    getJobByDocumentId,
    getJobById,
    isProcessing,
    getProgress,
  }
}