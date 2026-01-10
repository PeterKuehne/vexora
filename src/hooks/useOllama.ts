/**
 * useOllama Hook
 *
 * Custom React hook for interacting with the Ollama API.
 * Provides:
 * - Model listing with caching
 * - Health check with status tracking
 * - Streaming chat with progress updates
 * - Loading and error states
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  fetchModels,
  checkHealth,
  streamChat,
  type StreamMetadata,
  type StreamProgress,
  type ChatOptions,
} from '../lib/api';
import type { Message } from '../types/message';

// ============================================
// Types
// ============================================

export interface OllamaModel {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  quantization: string;
  sizeGB: number;
  isDefault: boolean;
}

export interface OllamaHealthStatus {
  status: 'ok' | 'degraded' | 'error' | 'unknown';
  isConnected: boolean;
  availableModels: string[];
  lastChecked: Date | null;
}

export interface UseOllamaOptions {
  /** Auto-fetch models on mount */
  autoFetchModels?: boolean;
  /** Auto-check health on mount */
  autoCheckHealth?: boolean;
  /** Health check interval in ms (0 to disable) */
  healthCheckInterval?: number;
  /** Cache duration for models in ms */
  modelsCacheDuration?: number;
}

export interface UseOllamaReturn {
  // Models
  models: OllamaModel[];
  defaultModel: string | null;
  isLoadingModels: boolean;
  modelsError: Error | null;
  refreshModels: () => Promise<void>;

  // Health
  health: OllamaHealthStatus;
  isCheckingHealth: boolean;
  healthError: Error | null;
  checkHealthStatus: () => Promise<void>;

  // Chat Streaming
  isStreaming: boolean;
  streamProgress: StreamProgress | null;
  streamError: Error | null;
  sendMessage: (
    messages: Message[],
    callbacks: {
      onToken: (token: string) => void;
      onComplete: (response: string, metadata?: StreamMetadata) => void;
      onError: (error: Error) => void;
      onProgress?: (progress: StreamProgress) => void;
    },
    options?: {
      model?: string;
      chatOptions?: ChatOptions;
    }
  ) => Promise<void>;
  stopStream: () => void;

  // General
  isOllamaAvailable: boolean;
}

// Default options
const DEFAULT_OPTIONS: Required<UseOllamaOptions> = {
  autoFetchModels: true,
  autoCheckHealth: true,
  healthCheckInterval: 30000, // 30 seconds
  modelsCacheDuration: 60000, // 1 minute
};

// ============================================
// Hook Implementation
// ============================================

export function useOllama(options: UseOllamaOptions = {}): UseOllamaReturn {
  // Merge options with defaults (explicit types to satisfy exactOptionalPropertyTypes)
  const autoFetchModels: boolean =
    options.autoFetchModels !== undefined ? options.autoFetchModels : DEFAULT_OPTIONS.autoFetchModels;
  const autoCheckHealth: boolean =
    options.autoCheckHealth !== undefined ? options.autoCheckHealth : DEFAULT_OPTIONS.autoCheckHealth;
  const healthCheckInterval: number =
    options.healthCheckInterval !== undefined ? options.healthCheckInterval : DEFAULT_OPTIONS.healthCheckInterval;
  const modelsCacheDuration: number =
    options.modelsCacheDuration !== undefined ? options.modelsCacheDuration : DEFAULT_OPTIONS.modelsCacheDuration;

  // Models state
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<Error | null>(null);

  // Health state
  const [health, setHealth] = useState<OllamaHealthStatus>({
    status: 'unknown',
    isConnected: false,
    availableModels: [],
    lastChecked: null,
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState<Error | null>(null);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null);
  const [streamError, setStreamError] = useState<Error | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelsCacheTimeRef = useRef<number>(0);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Fetch available models from Ollama
   */
  const refreshModels = useCallback(async () => {
    // Check cache
    const now = Date.now();
    if (
      models.length > 0 &&
      modelsCacheDuration > 0 &&
      now - modelsCacheTimeRef.current < modelsCacheDuration
    ) {
      return; // Use cached data
    }

    setIsLoadingModels(true);
    setModelsError(null);

    try {
      const result = await fetchModels();
      setModels(result.models);
      setDefaultModel(result.defaultModel);
      modelsCacheTimeRef.current = now;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch models');
      setModelsError(err);
    } finally {
      setIsLoadingModels(false);
    }
  }, [models.length, modelsCacheDuration]);

  /**
   * Force refresh models (bypass cache)
   */
  const forceRefreshModels = useCallback(async () => {
    modelsCacheTimeRef.current = 0;
    await refreshModels();
  }, [refreshModels]);

  /**
   * Check Ollama health status
   */
  const checkHealthStatus = useCallback(async () => {
    setIsCheckingHealth(true);
    setHealthError(null);

    try {
      const result = await checkHealth();
      setHealth({
        status: result.status,
        isConnected: result.status === 'ok',
        availableModels: result.services.ollama.available_models,
        lastChecked: new Date(),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Health check failed');
      setHealthError(err);
      setHealth((prev) => ({
        ...prev,
        status: 'error',
        isConnected: false,
        lastChecked: new Date(),
      }));
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  /**
   * Send a chat message with streaming
   */
  const sendMessage = useCallback(
    async (
      messages: Message[],
      callbacks: {
        onToken: (token: string) => void;
        onComplete: (response: string, metadata?: StreamMetadata) => void;
        onError: (error: Error) => void;
        onProgress?: (progress: StreamProgress) => void;
      },
      chatOptions?: {
        model?: string;
        chatOptions?: ChatOptions;
      }
    ) => {
      if (isStreaming) {
        callbacks.onError(new Error('A stream is already in progress'));
        return;
      }

      setIsStreaming(true);
      setStreamProgress(null);
      setStreamError(null);

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        await streamChat(
          messages,
          {
            onToken: callbacks.onToken,
            onProgress: (progress) => {
              setStreamProgress(progress);
              callbacks.onProgress?.(progress);
            },
            onComplete: (response, metadata) => {
              setIsStreaming(false);
              setStreamProgress(null);
              callbacks.onComplete(response, metadata);
            },
            onError: (error) => {
              setIsStreaming(false);
              setStreamProgress(null);
              setStreamError(error);
              callbacks.onError(error);
            },
          },
          {
            model: chatOptions?.model,
            chatOptions: chatOptions?.chatOptions,
            signal: abortControllerRef.current.signal,
          }
        );
      } catch (error) {
        setIsStreaming(false);
        setStreamProgress(null);
        const err = error instanceof Error ? error : new Error('Stream failed');
        setStreamError(err);
        callbacks.onError(err);
      }
    },
    [isStreaming]
  );

  /**
   * Stop the current stream
   */
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamProgress(null);
  }, []);

  // Auto-fetch models on mount
  useEffect(() => {
    if (autoFetchModels) {
      void refreshModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-check health on mount
  useEffect(() => {
    if (autoCheckHealth) {
      void checkHealthStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup health check interval
  useEffect(() => {
    if (healthCheckInterval > 0) {
      healthCheckIntervalRef.current = setInterval(() => {
        void checkHealthStatus();
      }, healthCheckInterval);
    }

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthCheckInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, []);

  // Computed value
  const isOllamaAvailable = health.isConnected && health.status === 'ok';

  return {
    // Models
    models,
    defaultModel,
    isLoadingModels,
    modelsError,
    refreshModels: forceRefreshModels,

    // Health
    health,
    isCheckingHealth,
    healthError,
    checkHealthStatus,

    // Streaming
    isStreaming,
    streamProgress,
    streamError,
    sendMessage,
    stopStream,

    // General
    isOllamaAvailable,
  };
}
