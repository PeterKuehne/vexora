/**
 * ModelSettings Component
 *
 * Model settings tab component with:
 * - Model Profile Selector (predefined hardware configurations)
 * - Default Model Selector
 * - Embedding Model Selector (for RAG)
 * - Temperature Slider (0-2)
 * - System Prompt Textarea
 * - Max Tokens Input
 * - Generation Parameters Management
 */

import { useState, useEffect } from 'react';
import { Cpu, Thermometer, MessageSquare, Hash, Info, Database, AlertTriangle, Monitor, MemoryStick, Scale, Layers } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import ModelSelector from './ModelSelector';
import { fetchEmbeddingModels, type APIModel } from '../lib/api';
import { ConfirmDialog } from './ConfirmDialog';
import { MODEL_PROFILES, type ModelProfile } from '../types/settings';

export interface ModelSettingsProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Model Settings tab content component
 */
export function ModelSettings({ className = '' }: ModelSettingsProps) {
  const { isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { info, warning } = useToast();

  // Local state for generation parameters (not persisted yet)
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Embedding model state
  const [embeddingModels, setEmbeddingModels] = useState<APIModel[]>([]);
  const [isLoadingEmbedding, setIsLoadingEmbedding] = useState(false);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const [showReindexWarning, setShowReindexWarning] = useState(false);
  const [pendingEmbeddingModel, setPendingEmbeddingModel] = useState<string | null>(null);

  // Model profile state
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<ModelProfile | null>(null);

  // Get current profile
  const currentProfile = MODEL_PROFILES.find(p => p.id === settings.modelProfile) || MODEL_PROFILES.find(p => p.id === 'custom')!;
  const isCustomProfile = settings.modelProfile === 'custom';

  // Load initial system prompt from settings
  useEffect(() => {
    // Temperature and maxTokens will come from generation params context in the future
    setTemperature(0.7);
    setMaxTokens(4096);
  }, []);

  // Load embedding models on mount
  useEffect(() => {
    async function loadEmbeddingModels() {
      setIsLoadingEmbedding(true);
      setEmbeddingError(null);
      try {
        const result = await fetchEmbeddingModels();
        setEmbeddingModels(result.models);
      } catch (err) {
        console.error('Failed to load embedding models:', err);
        setEmbeddingError(err instanceof Error ? err.message : 'Fehler beim Laden der Embedding-Modelle');
      } finally {
        setIsLoadingEmbedding(false);
      }
    }
    loadEmbeddingModels();
  }, []);

  /**
   * Handle model profile selection
   */
  const handleProfileSelect = (profileId: string) => {
    const profile = MODEL_PROFILES.find(p => p.id === profileId);
    if (!profile) return;

    // Custom profile doesn't need confirmation
    if (profile.id === 'custom') {
      updateSetting('modelProfile', 'custom');
      info('Benutzerdefiniertes Profil aktiviert - manuelle Modell-Auswahl möglich');
      return;
    }

    // Show confirmation for other profiles
    setPendingProfile(profile);
    setShowProfileConfirm(true);
  };

  /**
   * Confirm profile change - applies all profile settings
   */
  const handleConfirmProfileChange = () => {
    if (!pendingProfile) return;

    // Apply all profile settings
    updateSetting('modelProfile', pendingProfile.id);
    updateSetting('defaultModel', pendingProfile.llmModel);
    if (pendingProfile.embeddingModel) {
      updateSetting('embeddingModel', pendingProfile.embeddingModel);
    }
    setTemperature(pendingProfile.temperature);
    setMaxTokens(pendingProfile.maxTokens);

    info(`Profil "${pendingProfile.name}" aktiviert - alle Einstellungen wurden angepasst`, {
      title: 'Profil gewechselt',
      duration: 5000,
    });

    setShowProfileConfirm(false);
    setPendingProfile(null);
  };

  /**
   * Cancel profile change
   */
  const handleCancelProfileChange = () => {
    setShowProfileConfirm(false);
    setPendingProfile(null);
  };

  /**
   * Handle default model change
   */
  const handleDefaultModelChange = (modelId: string) => {
    updateSetting('defaultModel', modelId);
    // When manually changing model, switch to custom profile
    if (settings.modelProfile !== 'custom') {
      updateSetting('modelProfile', 'custom');
    }
    info(`Standard-Modell wurde auf "${modelId}" geändert`);
  };

  /**
   * Handle temperature change
   */
  const handleTemperatureChange = (value: number) => {
    setTemperature(value);
    info(`Temperatur wurde auf ${value.toFixed(1)} geändert`);
  };

  /**
   * Handle max tokens change
   */
  const handleMaxTokensChange = (value: number) => {
    setMaxTokens(value);
    info(`Max Tokens wurde auf ${value} geändert`);
  };

  /**
   * Handle system prompt change
   */
  const handleSystemPromptChange = (prompt: string) => {
    updateSetting('systemPrompt', prompt);
    if (prompt.trim()) {
      info('System-Prompt wurde aktualisiert');
    } else {
      info('System-Prompt wurde entfernt');
    }
  };

  /**
   * Handle embedding model change - shows warning first
   */
  const handleEmbeddingModelSelect = (modelId: string) => {
    if (modelId === settings.embeddingModel) return;
    setPendingEmbeddingModel(modelId);
    setShowReindexWarning(true);
  };

  /**
   * Confirm embedding model change
   */
  const handleConfirmEmbeddingChange = () => {
    if (pendingEmbeddingModel) {
      updateSetting('embeddingModel', pendingEmbeddingModel);
      warning(`Embedding-Modell geändert zu "${pendingEmbeddingModel}". Dokumente müssen neu indiziert werden.`, {
        title: 'Re-Indexierung erforderlich',
        duration: 8000,
      });
    }
    setShowReindexWarning(false);
    setPendingEmbeddingModel(null);
  };

  /**
   * Cancel embedding model change
   */
  const handleCancelEmbeddingChange = () => {
    setShowReindexWarning(false);
    setPendingEmbeddingModel(null);
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div>
        <h3
          className={`
            text-[13px] font-semibold uppercase tracking-wider mb-1
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `}
        >
          Modell-Einstellungen
        </h3>
        <p className={`text-[13px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          Standard-Modell, Generierungs-Parameter und System-Prompt
        </p>
      </div>

      {/* Model Profile Selector */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-500'}
            `}
          >
            <Monitor size={14} />
          </div>
          Model-Profil
        </label>
        <div className="space-y-2">
          <select
            value={settings.modelProfile || 'custom'}
            onChange={(e) => handleProfileSelect(e.target.value)}
            className={`
              w-full px-4 py-2.5 rounded-xl border text-[13px]
              transition-all duration-150
              focus:outline-none focus:ring-0
              cursor-pointer
              ${isDark
                ? 'bg-white/[0.03] border-white/[0.08] text-white focus:border-white/[0.15]'
                : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
              }
            `}
            aria-label="Model-Profil auswählen"
          >
            {MODEL_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} {profile.estimatedVRAM > 0 ? `(~${profile.estimatedVRAM}GB VRAM)` : ''}
              </option>
            ))}
          </select>
          <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            {currentProfile.description}
          </p>
          {!isCustomProfile && (
            <div
              className={`
                relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl text-[12px]
                ${isDark
                  ? 'bg-blue-500/5 border border-blue-500/10 text-gray-400'
                  : 'bg-blue-50 border border-blue-100 text-gray-600'
                }
              `}
            >
              <div className={`absolute inset-0 opacity-30 ${isDark ? 'bg-gradient-to-br from-blue-500/5 via-transparent to-transparent' : ''}`} />
              <div
                className={`
                  relative w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
                  ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-500'}
                `}
              >
                <MemoryStick size={12} />
              </div>
              <div className="relative">
                <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Aktives Profil:</strong> {currentProfile.name}<br />
                LLM: {currentProfile.llmModel} • Temp: {currentProfile.temperature} • Max Tokens: {currentProfile.maxTokens}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showProfileConfirm}
        title="Model-Profil wechseln"
        message={pendingProfile
          ? `Das Profil "${pendingProfile.name}" wird folgende Einstellungen setzen:\n\n• LLM: ${pendingProfile.llmModel}\n• Embedding: ${pendingProfile.embeddingModel}\n• Temperatur: ${pendingProfile.temperature}\n• Max Tokens: ${pendingProfile.maxTokens}\n• Geschätzter VRAM: ~${pendingProfile.estimatedVRAM}GB\n\nMöchten Sie fortfahren?`
          : ''
        }
        confirmText="Profil aktivieren"
        cancelText="Abbrechen"
        confirmVariant="primary"
        onConfirm={handleConfirmProfileChange}
        onCancel={handleCancelProfileChange}
      />

      {/* Default Model Selector */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-500'}
            `}
          >
            <Cpu size={14} />
          </div>
          Standard-Modell {!isCustomProfile && <span className="text-[11px] text-gray-500">(vom Profil)</span>}
        </label>
        <div className="space-y-2">
          <ModelSelector
            value={settings.defaultModel || 'ovh:gpt-oss-120b'}
            onChange={handleDefaultModelChange}
            placeholder="Modell wählen..."
            showDetails={true}
            autoLoad={true}
            className="w-full"
          />
          <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Das Standard-Modell wird für neue Unterhaltungen verwendet
          </p>
        </div>
      </div>

      {/* Embedding Model Selector */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-500'}
            `}
          >
            <Database size={14} />
          </div>
          Embedding-Modell (RAG)
        </label>
        <div className="space-y-2">
          {isLoadingEmbedding ? (
            <div
              className={`
                px-4 py-2.5 rounded-xl border text-[13px]
                ${isDark
                  ? 'bg-white/[0.03] border-white/[0.06] text-gray-500'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
                }
              `}
            >
              Lade Embedding-Modelle...
            </div>
          ) : embeddingError ? (
            <div
              className={`
                px-4 py-2.5 rounded-xl border text-[13px]
                ${isDark
                  ? 'bg-red-500/5 border-red-500/20 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-600'
                }
              `}
            >
              {embeddingError}
            </div>
          ) : embeddingModels.length === 0 ? (
            <div
              className={`
                px-4 py-2.5 rounded-xl border text-[13px]
                ${isDark
                  ? 'bg-white/[0.03] border-white/[0.06] text-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
                }
              `}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Keine Embedding-Modelle gefunden. Installieren Sie z.B. <code className="font-mono">nomic-embed-text-v2-moe</code> mit <code className="font-mono">ollama pull nomic-embed-text-v2-moe</code>
            </div>
          ) : (
            <select
              value={settings.embeddingModel || ''}
              onChange={(e) => handleEmbeddingModelSelect(e.target.value)}
              className={`
                w-full px-4 py-2.5 rounded-xl border text-[13px]
                transition-all duration-150
                focus:outline-none focus:ring-0
                cursor-pointer
                ${isDark
                  ? 'bg-white/[0.03] border-white/[0.08] text-white focus:border-white/[0.15]'
                  : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                }
              `}
              aria-label="Embedding-Modell auswählen"
            >
              {embeddingModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id} ({model.sizeGB} GB)
                </option>
              ))}
            </select>
          )}
          <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Das Embedding-Modell wird für die semantische Dokumentensuche verwendet
          </p>
          <div
            className={`
              relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl text-[12px]
              ${isDark
                ? 'bg-amber-500/5 border border-amber-500/10 text-gray-500'
                : 'bg-amber-50 border border-amber-100 text-gray-500'
              }
            `}
          >
            <div className={`absolute inset-0 opacity-30 ${isDark ? 'bg-gradient-to-br from-amber-500/5 via-transparent to-transparent' : ''}`} />
            <div
              className={`
                relative w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
                ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-500'}
              `}
            >
              <AlertTriangle size={12} />
            </div>
            <div className="relative">
              <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Hinweis:</strong> Bei Änderung des Embedding-Modells müssen alle Dokumente
              neu indiziert werden, damit die semantische Suche korrekt funktioniert.
            </div>
          </div>
        </div>
      </div>

      {/* Re-indexing Warning Dialog */}
      <ConfirmDialog
        isOpen={showReindexWarning}
        title="Embedding-Modell ändern"
        message={`Wenn Sie das Embedding-Modell auf "${pendingEmbeddingModel}" ändern, müssen alle Dokumente neu indiziert werden. Die bestehende Dokumentensuche funktioniert möglicherweise nicht mehr korrekt bis alle Dokumente neu verarbeitet wurden.`}
        confirmText="Modell ändern"
        cancelText="Abbrechen"
        confirmVariant="danger"
        onConfirm={handleConfirmEmbeddingChange}
        onCancel={handleCancelEmbeddingChange}
      />

      {/* Hybrid Search Balance Slider */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-500'}
            `}
          >
            <Scale size={14} />
          </div>
          Hybrid Search Balance
        </label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Keyword
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.hybridSearchAlpha ?? 0.3}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                updateSetting('hybridSearchAlpha', value);
                info(`Hybrid Search Balance: ${value === 0 ? 'Keyword (BM25)' : value === 1 ? 'Semantisch (Vector)' : `${Math.round(value * 100)}% Semantisch`}`);
              }}
              className={`
                flex-1 h-1.5 rounded-lg appearance-none cursor-pointer
                ${isDark
                  ? 'bg-white/[0.10] [&::-webkit-slider-thumb]:bg-violet-400'
                  : 'bg-gray-200 [&::-webkit-slider-thumb]:bg-violet-500'
                }
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-webkit-slider-thumb]:shadow-sm
                [&::-moz-range-thumb]:bg-violet-400
                [&::-moz-range-thumb]:border-none
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:cursor-pointer
              `}
              aria-label="Hybrid Search Balance zwischen Keyword und Semantischer Suche"
            />
            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Semantic
            </span>
            <div
              className={`
                min-w-[52px] px-2.5 py-1.5 rounded-lg text-center text-[13px] font-mono
                ${isDark
                  ? 'bg-white/[0.03] border border-white/[0.06] text-white'
                  : 'bg-gray-50 border border-gray-200 text-gray-900'
                }
              `}
            >
              {((settings.hybridSearchAlpha ?? 0.3) * 100).toFixed(0)}%
            </div>
          </div>
          <div
            className={`
              relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl text-[12px]
              ${isDark
                ? 'bg-violet-500/5 border border-violet-500/10 text-gray-500'
                : 'bg-violet-50 border border-violet-100 text-gray-500'
              }
            `}
          >
            <div className={`absolute inset-0 opacity-30 ${isDark ? 'bg-gradient-to-br from-violet-500/5 via-transparent to-transparent' : ''}`} />
            <div
              className={`
                relative w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
                ${isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-100 text-violet-500'}
              `}
            >
              <Info size={12} />
            </div>
            <div className="relative">
              <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Hybrid Search Balance:</strong><br />
              • 0% (Keyword): Exakte Wort-Übereinstimmung (BM25)<br />
              • 50% (Empfohlen): Ausgewogene Hybrid-Suche<br />
              • 100% (Semantic): Bedeutungsbasierte Vektor-Suche
            </div>
          </div>
        </div>
      </div>

      {/* Top-K Chunks Slider */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}
            `}
          >
            <Layers size={14} />
          </div>
          Top-K Chunks (RAG)
        </label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              1
            </span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.ragTopK ?? 5}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                updateSetting('ragTopK', value);
                info(`Top-K Chunks: ${value} ${value === 1 ? 'Chunk' : 'Chunks'} werden für RAG abgerufen`);
              }}
              className={`
                flex-1 h-1.5 rounded-lg appearance-none cursor-pointer
                ${isDark
                  ? 'bg-white/[0.10] [&::-webkit-slider-thumb]:bg-emerald-400'
                  : 'bg-gray-200 [&::-webkit-slider-thumb]:bg-emerald-500'
                }
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-webkit-slider-thumb]:shadow-sm
                [&::-moz-range-thumb]:bg-emerald-400
                [&::-moz-range-thumb]:border-none
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:cursor-pointer
              `}
              aria-label="Anzahl der Top-K Chunks für RAG-Suche"
            />
            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              10
            </span>
            <div
              className={`
                min-w-[52px] px-2.5 py-1.5 rounded-lg text-center text-[13px] font-mono
                ${isDark
                  ? 'bg-white/[0.03] border border-white/[0.06] text-white'
                  : 'bg-gray-50 border border-gray-200 text-gray-900'
                }
              `}
            >
              {settings.ragTopK ?? 5}
            </div>
          </div>
          <div
            className={`
              relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl text-[12px]
              ${isDark
                ? 'bg-emerald-500/5 border border-emerald-500/10 text-gray-500'
                : 'bg-emerald-50 border border-emerald-100 text-gray-500'
              }
            `}
          >
            <div className={`absolute inset-0 opacity-30 ${isDark ? 'bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent' : ''}`} />
            <div
              className={`
                relative w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
                ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-500'}
              `}
            >
              <Info size={12} />
            </div>
            <div className="relative">
              <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Top-K Chunks:</strong> Anzahl der relevantesten Dokumentabschnitte für RAG.<br />
              • Weniger Chunks (1-3): Schnellere Antworten, fokussierter Kontext<br />
              • Mehr Chunks (5-10): Mehr Kontext, aber längere Antwortzeit
            </div>
          </div>
        </div>
      </div>

      {/* Temperature Slider */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-500'}
            `}
          >
            <Thermometer size={14} />
          </div>
          Temperatur
        </label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
              className={`
                flex-1 h-1.5 rounded-lg appearance-none cursor-pointer
                ${isDark
                  ? 'bg-white/[0.10] [&::-webkit-slider-thumb]:bg-blue-400'
                  : 'bg-gray-200 [&::-webkit-slider-thumb]:bg-blue-500'
                }
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-webkit-slider-thumb]:shadow-sm
                [&::-moz-range-thumb]:bg-blue-400
                [&::-moz-range-thumb]:border-none
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:cursor-pointer
              `}
              aria-label="Temperatur für Textgenerierung"
            />
            <div
              className={`
                min-w-[52px] px-2.5 py-1.5 rounded-lg text-center text-[13px] font-mono
                ${isDark
                  ? 'bg-white/[0.03] border border-white/[0.06] text-white'
                  : 'bg-gray-50 border border-gray-200 text-gray-900'
                }
              `}
            >
              {temperature.toFixed(1)}
            </div>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>
              0.0 (Deterministisch)
            </span>
            <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>
              2.0 (Sehr kreativ)
            </span>
          </div>
          <div
            className={`
              relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl text-[12px]
              ${isDark
                ? 'bg-blue-500/5 border border-blue-500/10 text-gray-500'
                : 'bg-blue-50 border border-blue-100 text-gray-500'
              }
            `}
          >
            <div className={`absolute inset-0 opacity-30 ${isDark ? 'bg-gradient-to-br from-blue-500/5 via-transparent to-transparent' : ''}`} />
            <div
              className={`
                relative w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
                ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-500'}
              `}
            >
              <Info size={12} />
            </div>
            <div className="relative">
              <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Temperatur-Werte:</strong><br />
              • 0.0-0.3: Präzise, vorhersagbare Antworten<br />
              • 0.4-0.8: Ausgewogene Kreativität (empfohlen)<br />
              • 0.9-2.0: Sehr kreative, unvorhersagbare Antworten
            </div>
          </div>
        </div>
      </div>

      {/* Max Tokens Input */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-500'}
            `}
          >
            <Hash size={14} />
          </div>
          Maximale Tokens
        </label>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="32768"
              step="1"
              value={maxTokens}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value) || 4096)}
              className={`
                flex-1 px-4 py-2.5 rounded-xl border text-[13px]
                transition-all duration-150
                focus:outline-none focus:ring-0
                font-mono
                ${isDark
                  ? 'bg-white/[0.03] border-white/[0.08] text-white placeholder-gray-600 focus:border-white/[0.15]'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
                }
              `}
              placeholder="4096"
              aria-label="Maximale Anzahl Tokens für Antworten"
            />
            <div className="flex gap-1.5">
              {[1024, 2048, 4096, 8192].map((value) => (
                <button
                  key={value}
                  onClick={() => handleMaxTokensChange(value)}
                  className={`
                    px-2.5 py-1.5 text-[11px] font-mono rounded-lg
                    transition-all duration-150
                    ${maxTokens === value
                      ? isDark
                        ? 'bg-white text-gray-900'
                        : 'bg-gray-900 text-white'
                      : isDark
                        ? 'bg-white/[0.03] text-gray-500 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
                        : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
                    }
                  `}
                  aria-label={`Max Tokens auf ${value} setzen`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Begrenzt die Länge der generierten Antworten (1 Token ≈ 0,75 Wörter)
          </p>
        </div>
      </div>

      {/* Divider */}
      <hr className={isDark ? 'border-white/[0.06]' : 'border-gray-200/80'} />

      {/* System Prompt Textarea */}
      <div className="space-y-3">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-500'}
            `}
          >
            <MessageSquare size={14} />
          </div>
          System-Prompt
        </label>
        <div className="space-y-3">
          <textarea
            value={settings.systemPrompt || ''}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder="Geben Sie hier einen System-Prompt ein, um das Verhalten der KI zu beeinflussen..."
            rows={6}
            className={`
              w-full px-4 py-3 rounded-xl border text-[13px]
              transition-all duration-150
              focus:outline-none focus:ring-0
              resize-vertical leading-relaxed
              ${isDark
                ? 'bg-white/[0.03] border-white/[0.08] text-white placeholder-gray-600 focus:border-white/[0.15]'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'
              }
            `}
            aria-label="System-Prompt für KI-Verhalten"
          />
          <div
            className={`
              relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl text-[12px]
              ${isDark
                ? 'bg-amber-500/5 border border-amber-500/10 text-gray-500'
                : 'bg-amber-50 border border-amber-100 text-gray-500'
              }
            `}
          >
            <div className={`absolute inset-0 opacity-30 ${isDark ? 'bg-gradient-to-br from-amber-500/5 via-transparent to-transparent' : ''}`} />
            <div
              className={`
                relative w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
                ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-500'}
              `}
            >
              <Info size={12} />
            </div>
            <div className="relative">
              <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>System-Prompt:</strong> Definiert das Grundverhalten und die Rolle der KI.
              Beispiele: "Du bist ein hilfreicher Assistent für Programmierung" oder
              "Antworte immer sehr kurz und präzise". Leer lassen für Standard-Verhalten.
            </div>
          </div>
          {settings.systemPrompt && settings.systemPrompt.trim() && (
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                {settings.systemPrompt.length} Zeichen
              </span>
              <button
                onClick={() => handleSystemPromptChange('')}
                className={`
                  text-[11px] px-2 py-1 rounded-lg transition-all duration-150
                  ${isDark
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-red-600 hover:bg-red-50'
                  }
                `}
                aria-label="System-Prompt löschen"
              >
                Leeren
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModelSettings;
