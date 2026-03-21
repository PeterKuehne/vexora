/**
 * ModelSelector Component - Dropdown for selecting AI models
 *
 * Uses Headless UI Listbox for accessible dropdown behavior.
 * Loads available models from the backend and allows filtering.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react';
import { ChevronDown, Check, Search, Cpu, HardDrive, X, AlertTriangle, Cloud, Shield } from 'lucide-react';
import { useTheme, useToast } from '../contexts';
import { fetchModels, type CloudModel } from '../lib/api';

// ============================================
// Types
// ============================================

export interface Model {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  quantization: string;
  sizeGB: number;
  isDefault: boolean;
}

export interface ModelSelectorProps {
  /** Currently selected model ID */
  value: string;
  /** Callback when model is changed */
  onChange: (modelId: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Placeholder text when no model selected */
  placeholder?: string;
  /** Whether to show model details in dropdown */
  showDetails?: boolean;
  /** Whether to auto-load models on mount */
  autoLoad?: boolean;
  /** Whether to auto-fallback to default if selected model is unavailable */
  autoFallback?: boolean;
  /** Callback when model is not available (for external handling) */
  onModelUnavailable?: (unavailableModelId: string, fallbackModelId: string | null) => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format model display name
 */
function formatModelName(model: Model): string {
  return model.name;
}

/**
 * Format model size for display
 */
function formatSize(sizeGB: number): string {
  if (sizeGB < 1) {
    return `${Math.round(sizeGB * 1024)} MB`;
  }
  return `${sizeGB.toFixed(1)} GB`;
}

// ============================================
// ModelSelector Component
// ============================================

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Modell wählen...',
  showDetails = true,
  autoLoad = true,
  autoFallback = true,
  onModelUnavailable,
}: ModelSelectorProps) {
  const { isDark } = useTheme();
  const { addToast } = useToast();

  // State
  const [models, setModels] = useState<Model[]>([]);
  const [cloudModels, setCloudModels] = useState<CloudModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modelUnavailable, setModelUnavailable] = useState(false);

  // Track if we've already checked availability to avoid duplicate notifications
  const availabilityCheckedRef = useRef<string | null>(null);

  // Load models from API
  const loadModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchModels();
      setModels(response.models);
      setCloudModels(response.cloudModels || []);

      // If no model selected yet, select the default
      if (!value && response.defaultModel) {
        onChange(response.defaultModel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Modelle');
    } finally {
      setIsLoading(false);
    }
  }, [value, onChange]);

  // Auto-load models on mount
  useEffect(() => {
    if (autoLoad && models.length === 0) {
      loadModels();
    }
  }, [autoLoad, models.length, loadModels]);

  // Check if selected model is available
  useEffect(() => {
    // Skip if no value, no models loaded, or already checked this value
    if (!value || models.length === 0 || availabilityCheckedRef.current === value) {
      return;
    }

    const isModelAvailable = models.some((m) => m.id === value) || cloudModels.some((m) => m.id === value);

    if (!isModelAvailable) {
      // Mark as checked to prevent duplicate notifications
      availabilityCheckedRef.current = value;
      setModelUnavailable(true);

      // Find default model for fallback
      const defaultModel = models.find((m) => m.isDefault);
      const fallbackModelId = defaultModel?.id ?? models[0]?.id ?? null;

      // Notify external handler if provided
      if (onModelUnavailable) {
        onModelUnavailable(value, fallbackModelId);
      }

      // Show toast notification
      addToast(
        'warning',
        `Das Modell "${value}" ist nicht mehr verfügbar.${
          fallbackModelId ? ` Wechsle zu "${fallbackModelId}".` : ''
        }`,
        { duration: 6000 }
      );

      // Auto-fallback to default model
      if (autoFallback && fallbackModelId) {
        onChange(fallbackModelId);
      }
    } else {
      // Reset unavailable state when model becomes available
      setModelUnavailable(false);
      availabilityCheckedRef.current = value;
    }
  }, [value, models, cloudModels, autoFallback, onChange, onModelUnavailable, addToast]);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) {
      return models;
    }

    const query = searchQuery.toLowerCase();
    return models.filter(
      (model) =>
        model.id.toLowerCase().includes(query) ||
        model.name.toLowerCase().includes(query) ||
        model.family.toLowerCase().includes(query) ||
        model.parameterSize.toLowerCase().includes(query)
    );
  }, [models, searchQuery]);

  // Filter cloud models based on search query
  const filteredCloudModels = useMemo(() => {
    if (!searchQuery.trim()) return cloudModels;
    const query = searchQuery.toLowerCase();
    return cloudModels.filter(
      (m) => m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)
    );
  }, [cloudModels, searchQuery]);

  // Find currently selected model (local or cloud)
  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === value);
  }, [models, value]);

  const selectedCloudModel = useMemo(() => {
    return cloudModels.find((m) => m.id === value);
  }, [cloudModels, value]);

  // Clear search when dropdown closes
  const handleChange = (modelId: string) => {
    onChange(modelId);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={handleChange} disabled={disabled || isLoading}>
        {({ open }) => (
          <>
            {/* Trigger Button */}
            <ListboxButton
              className={`
                relative w-full min-w-[180px] cursor-pointer
                rounded-xl py-2 pl-3 pr-10 text-left text-[13px]
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-white/20
                ${disabled || isLoading ? 'cursor-not-allowed opacity-60' : ''}
                ${
                  isDark
                    ? 'bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] border border-white/[0.08]'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-sm'
                }
              `.trim()}
              aria-label="KI-Modell auswählen"
            >
              <span className="flex items-center gap-2 truncate">
                {modelUnavailable ? (
                  <AlertTriangle size={14} className="text-yellow-500" />
                ) : selectedCloudModel ? (
                  <Cloud size={14} className="text-blue-400" />
                ) : (
                  <Cpu size={14} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                )}
                {isLoading ? (
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    Lade Modelle...
                  </span>
                ) : modelUnavailable && !selectedModel && !selectedCloudModel ? (
                  <span className="text-yellow-500">
                    Modell nicht verfügbar
                  </span>
                ) : selectedCloudModel ? (
                  selectedCloudModel.name
                ) : selectedModel ? (
                  formatModelName(selectedModel)
                ) : (
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    {placeholder}
                  </span>
                )}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronDown
                  size={16}
                  className={`transition-transform ${open ? 'rotate-180' : ''} ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                />
              </span>
            </ListboxButton>

            {/* Dropdown Options */}
            <Transition
              show={open}
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-in"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <ListboxOptions
                className={`
                  absolute z-50 mt-1.5 w-full min-w-[280px] overflow-hidden
                  rounded-xl shadow-xl
                  focus:outline-none
                  ${isDark ? 'bg-neutral-900 border border-white/[0.08]' : 'bg-white border border-gray-200/80 shadow-lg'}
                `.trim()}
              >
                {/* Search Input */}
                <div
                  className={`
                    sticky top-0 p-2
                    ${isDark ? 'bg-neutral-900 border-b border-white/[0.06]' : 'bg-white border-b border-gray-100'}
                  `}
                >
                  <div className="relative">
                    <Search
                      size={14}
                      className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Modelle suchen..."
                      aria-label="Modelle durchsuchen"
                      className={`
                        w-full py-1.5 pl-8 pr-8 text-sm rounded-lg
                        focus:outline-none focus:ring-1 focus:ring-white/20
                        ${
                          isDark
                            ? 'bg-white/[0.04] text-white placeholder-gray-500 border border-white/[0.06]'
                            : 'bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200/80'
                        }
                      `.trim()}
                      // Prevent listbox from closing when clicking input
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery('');
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${
                          isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title="Suche leeren"
                        aria-label="Modell-Suche leeren"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Error State */}
                {error && (
                  <div className="p-3 text-sm text-red-500">
                    {error}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadModels();
                      }}
                      className="ml-2 underline hover:no-underline"
                      aria-label="Modelle erneut laden"
                    >
                      Erneut versuchen
                    </button>
                  </div>
                )}

                {/* Model List */}
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredModels.length === 0 && filteredCloudModels.length === 0 && !error ? (
                    <div
                      className={`px-3 py-2 text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {searchQuery ? 'Keine Modelle gefunden' : 'Keine Modelle verfügbar'}
                    </div>
                  ) : (
                    <>
                      {/* Local Models Section */}
                      {filteredModels.length > 0 && (
                        <>
                          {filteredCloudModels.length > 0 && (
                            <div className={`px-3 py-1 text-[10px] uppercase tracking-wider font-medium ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                              Lokale Modelle
                            </div>
                          )}
                          {filteredModels.map((model) => (
                            <ListboxOption
                              key={model.id}
                              value={model.id}
                              className={({ focus, selected }) =>
                                `
                                relative cursor-pointer select-none py-2 pl-3 pr-10
                                ${focus ? (isDark ? 'bg-white/10' : 'bg-black/5') : ''}
                                ${selected ? (isDark ? 'bg-primary/20' : 'bg-primary/10') : ''}
                              `.trim()
                              }
                            >
                              {({ selected }) => (
                                <>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-medium ${
                                          selected
                                            ? 'text-primary'
                                            : isDark
                                              ? 'text-white'
                                              : 'text-gray-900'
                                        }`}
                                      >
                                        {formatModelName(model)}
                                      </span>
                                      {model.isDefault && (
                                        <span
                                          className={`text-xs px-1.5 py-0.5 rounded ${
                                            isDark
                                              ? 'bg-primary/20 text-primary'
                                              : 'bg-primary/10 text-primary'
                                          }`}
                                        >
                                          Standard
                                        </span>
                                      )}
                                    </div>
                                    {showDetails && (
                                      <div
                                        className={`flex items-center gap-3 mt-0.5 text-xs ${
                                          isDark ? 'text-gray-400' : 'text-gray-500'
                                        }`}
                                      >
                                        <span className="flex items-center gap-1">
                                          <Cpu size={10} />
                                          {model.parameterSize || model.family}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <HardDrive size={10} />
                                          {formatSize(model.sizeGB)}
                                        </span>
                                        {model.quantization && (
                                          <span className="uppercase">{model.quantization}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {selected && (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-primary">
                                      <Check size={16} />
                                    </span>
                                  )}
                                </>
                              )}
                            </ListboxOption>
                          ))}
                        </>
                      )}

                      {/* Cloud Models Section */}
                      {filteredCloudModels.length > 0 && (
                        <>
                          <div className={`px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${isDark ? 'text-blue-400/60' : 'text-blue-500/60'}`}>
                            <Cloud size={10} />
                            Cloud-Modelle
                          </div>
                          <div className={`mx-3 mb-1 px-2 py-1 rounded text-[10px] flex items-center gap-1 ${isDark ? 'bg-blue-500/10 text-blue-300/60' : 'bg-blue-50 text-blue-500/70'}`}>
                            <Shield size={9} />
                            PII wird vor dem Senden maskiert
                          </div>
                          {filteredCloudModels.map((model) => (
                            <ListboxOption
                              key={model.id}
                              value={model.id}
                              className={({ focus, selected }) =>
                                `
                                relative cursor-pointer select-none py-2 pl-3 pr-10
                                ${focus ? (isDark ? 'bg-white/10' : 'bg-black/5') : ''}
                                ${selected ? (isDark ? 'bg-blue-500/20' : 'bg-blue-50') : ''}
                              `.trim()
                              }
                            >
                              {({ selected }) => (
                                <>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <Cloud size={12} className="text-blue-400" />
                                      <span
                                        className={`font-medium ${
                                          selected
                                            ? 'text-blue-400'
                                            : isDark
                                              ? 'text-white'
                                              : 'text-gray-900'
                                        }`}
                                      >
                                        {model.name}
                                      </span>
                                    </div>
                                    {showDetails && (
                                      <div className={`flex items-center gap-3 mt-0.5 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <span>{Math.round(model.contextWindow / 1000)}K Kontext</span>
                                        {model.inputPricePerMTok && (
                                          <span className="text-blue-400/70">
                                            ~${((model.inputPricePerMTok * 1000 + (model.outputPricePerMTok || 0) * 500) / 1_000_000).toFixed(3)}/Query
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {selected && (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-400">
                                      <Check size={16} />
                                    </span>
                                  )}
                                </>
                              )}
                            </ListboxOption>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </ListboxOptions>
            </Transition>
          </>
        )}
      </Listbox>
    </div>
  );
}

// ============================================
// Compact Variant
// ============================================

export type ModelSelectorCompactProps = Omit<
  ModelSelectorProps,
  'showDetails' | 'placeholder'
>;

/**
 * Compact variant of ModelSelector without details
 */
export function ModelSelectorCompact(props: ModelSelectorCompactProps) {
  return <ModelSelector {...props} showDetails={false} placeholder="Modell" />;
}
