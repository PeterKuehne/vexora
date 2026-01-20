import { ProcessingJob, ProcessingStatus, ProcessingUpdate, ProcessingEvent } from '../types/processing.js';
import { EventEmitter } from 'events';

/**
 * ProcessingJobService - Manages asynchronous document processing jobs
 * Provides real-time status updates via events
 */
class ProcessingJobService extends EventEmitter {
  private jobs = new Map<string, ProcessingJob>();
  private jobQueue: ProcessingJob[] = [];
  private isProcessing = false;

  /**
   * Create a new processing job
   */
  createJob(documentId: string, filename: string, originalName: string): ProcessingJob {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: ProcessingJob = {
      id: jobId,
      documentId,
      filename,
      originalName,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    this.jobQueue.push(job);

    // Emit job created event
    this.emitJobEvent('job:created', job);

    // Start processing if not already running
    this.processNext();

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get jobs by document ID
   */
  getJobsByDocument(documentId: string): ProcessingJob[] {
    return Array.from(this.jobs.values()).filter(job => job.documentId === documentId);
  }

  /**
   * Update job status and emit event
   */
  private updateJob(jobId: string, updates: Partial<ProcessingJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Update job
    Object.assign(job, updates);
    this.jobs.set(jobId, job);

    // Create update data
    const update: ProcessingUpdate = {
      jobId: job.id,
      documentId: job.documentId,
      status: job.status,
      progress: job.progress,
      currentChunk: job.currentChunk,
      totalChunks: job.totalChunks,
      error: job.error,
      timestamp: new Date().toISOString(),
    };

    // Determine event type
    let eventType: ProcessingEvent['type'] = 'job:progress';
    if (job.status === 'processing' && !job.startedAt) {
      eventType = 'job:started';
    } else if (job.status === 'completed') {
      eventType = 'job:completed';
    } else if (job.status === 'failed') {
      eventType = 'job:failed';
    }

    // Emit event
    this.emitJobEvent(eventType, job);
  }

  /**
   * Emit processing event
   */
  private emitJobEvent(type: ProcessingEvent['type'], job: ProcessingJob): void {
    const event: ProcessingEvent = {
      type,
      jobId: job.id,
      data: {
        jobId: job.id,
        documentId: job.documentId,
        status: job.status,
        progress: job.progress,
        currentChunk: job.currentChunk,
        totalChunks: job.totalChunks,
        error: job.error,
        timestamp: new Date().toISOString(),
      },
    };

    this.emit('processingUpdate', event);
  }

  /**
   * Process next job in queue
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.jobQueue.shift()!;

    try {
      await this.processJob(job);
    } catch (error) {
      this.updateJob(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown processing error',
        completedAt: new Date().toISOString(),
      });
    }

    this.isProcessing = false;

    // Process next job if available
    if (this.jobQueue.length > 0) {
      setTimeout(() => this.processNext(), 100);
    }
  }

  /**
   * Process individual job with progress updates
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    // Mark as started
    this.updateJob(job.id, {
      status: 'processing',
      progress: 0,
      startedAt: new Date().toISOString(),
    });

    // Simulate chunk-based processing
    const totalChunks = 8; // Simulate 8 processing steps

    this.updateJob(job.id, {
      currentChunk: 0,
      totalChunks,
    });

    for (let chunk = 1; chunk <= totalChunks; chunk++) {
      // Simulate processing time
      await this.delay(200 + Math.random() * 300);

      const progress = Math.round((chunk / totalChunks) * 100);

      this.updateJob(job.id, {
        progress,
        currentChunk: chunk,
      });
    }

    // Mark as completed
    this.updateJob(job.id, {
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Simulate processing with random failure
   */
  simulateFailure(jobId: string, error: string): void {
    this.updateJob(jobId, {
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values()).filter(
      job => job.status === 'pending' || job.status === 'processing'
    );
  }

  /**
   * Clear completed jobs older than specified time
   */
  clearOldJobs(olderThanHours = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const completedAt = new Date(job.completedAt || job.createdAt);
        if (completedAt < cutoff) {
          this.jobs.delete(jobId);
        }
      }
    }
  }
}

export const processingJobService = new ProcessingJobService();