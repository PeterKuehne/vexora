/**
 * Processing Job Types for Real-time Status Updates
 */

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessingJob {
  id: string;
  documentId: string;
  filename: string;
  originalName: string;
  status: ProcessingStatus;
  progress: number; // 0-100
  currentChunk?: number;
  totalChunks?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ProcessingUpdate {
  jobId: string;
  documentId: string;
  status: ProcessingStatus;
  progress: number;
  currentChunk?: number;
  totalChunks?: number;
  error?: string;
  timestamp: string;
}

export type ProcessingEventType =
  | 'job:created'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed';

export interface ProcessingEvent {
  type: ProcessingEventType;
  jobId: string;
  data: ProcessingUpdate;
}