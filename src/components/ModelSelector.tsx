/**
 * ModelSelector Component - Dropdown for selecting AI models
 *
 * Uses Headless UI Listbox for accessible dropdown behavior.
 * Loads available models from the backend and allows filtering.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react';
import { ChevronDown, Check, Search, Cpu, HardDrive, X } from 'lucide-react';
import { useTheme } from '../contexts';
import { fetchModels } from '../lib/api';

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
}: ModelSelectorProps) {
  const { isDark } = useTheme();

  // State
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load models from API
  const loadModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchModels();
      setModels(response.models);

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

  // Find currently selected model
  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === value);
  }, [models, value]);

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
                rounded-lg py-2 pl-3 pr-10 text-left text-sm
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-primary/50
                ${disabled || isLoading ? 'cursor-not-allowed opacity-60' : ''}
                ${
                  isDark
                    ? 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                    : 'bg-black/5 text-gray-900 hover:bg-black/10 border border-black/10'
                }
              `.trim()}
            >
              <span className="flex items-center gap-2 truncate">
                <Cpu size={14} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                {isLoading ? (
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    Lade Modelle...
                  </span>
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
                  absolute z-50 mt-1 w-full min-w-[280px] overflow-hidden
                  rounded-lg shadow-lg ring-1 ring-black/5
                  focus:outline-none
                  ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}
                `.trim()}
              >
                {/* Search Input */}
                <div
                  className={`
                    sticky top-0 p-2
                    ${isDark ? 'bg-[#1e1e1e] border-b border-white/10' : 'bg-white border-b border-gray-200'}
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
                      className={`
                        w-full py-1.5 pl-8 pr-8 text-sm rounded-md
                        focus:outline-none focus:ring-1 focus:ring-primary/50
                        ${
                          isDark
                            ? 'bg-white/5 text-white placeholder-gray-500 border border-white/10'
                            : 'bg-black/5 text-gray-900 placeholder-gray-400 border border-black/10'
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
                    >
                      Erneut versuchen
                    </button>
                  </div>
                )}

                {/* Model List */}
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredModels.length === 0 && !error ? (
                    <div
                      className={`px-3 py-2 text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {searchQuery ? 'Keine Modelle gefunden' : 'Keine Modelle verfügbar'}
                    </div>
                  ) : (
                    filteredModels.map((model) => (
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
                    ))
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

export interface ModelSelectorCompactProps
  extends Omit<ModelSelectorProps, 'showDetails' | 'placeholder'> {}

/**
 * Compact variant of ModelSelector without details
 */
export function ModelSelectorCompact(props: ModelSelectorCompactProps) {
  return <ModelSelector {...props} showDetails={false} placeholder="Modell" />;
}
