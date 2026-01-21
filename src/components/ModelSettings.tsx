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
import { Cpu, Thermometer, MessageSquare, Hash, Info, Database, AlertTriangle, Monitor, MemoryStick, Scale } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { ModelSelector } from './ModelSelector';
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
        <h3 className="text-lg font-medium mb-2">Modell-Einstellungen</h3>
        <p
          className={`
            text-sm
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}
        >
          Standard-Modell, Generierungs-Parameter und System-Prompt
        </p>
      </div>

      {/* Model Profile Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <Monitor className="w-4 h-4 inline mr-2" />
          Model-Profil
        </label>
        <div className="space-y-2">
          <select
            value={settings.modelProfile || 'custom'}
            onChange={(e) => handleProfileSelect(e.target.value)}
            className={`
              w-full px-4 py-3 rounded-lg border transition-all duration-200
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              cursor-pointer
              ${isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
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
          <p
            className={`
              text-xs
              ${isDark ? 'text-gray-400' : 'text-gray-600'}
            `}
          >
            {currentProfile.description}
          </p>
          {!isCustomProfile && (
            <div
              className={`
                flex items-start gap-2 p-3 rounded-lg text-xs
                ${isDark ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-700'}
              `}
            >
              <MemoryStick className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>Aktives Profil:</strong> {currentProfile.name}<br />
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
        <label className="block text-sm font-medium">
          <Cpu className="w-4 h-4 inline mr-2" />
          Standard-Modell {!isCustomProfile && <span className="text-xs text-gray-500">(vom Profil)</span>}
        </label>
        <div className="space-y-2">
          <ModelSelector
            value={settings.defaultModel || 'qwen3:8b'}
            onChange={handleDefaultModelChange}
            placeholder="Modell wählen..."
            showDetails={true}
            autoLoad={true}
            className="w-full"
          />
          <p
            className={`
              text-xs
              ${isDark ? 'text-gray-400' : 'text-gray-600'}
            `}
          >
            Das Standard-Modell wird für neue Unterhaltungen verwendet
          </p>
        </div>
      </div>

      {/* Embedding Model Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <Database className="w-4 h-4 inline mr-2" />
          Embedding-Modell (RAG)
        </label>
        <div className="space-y-2">
          {isLoadingEmbedding ? (
            <div
              className={`
                px-4 py-3 rounded-lg border text-sm
                ${isDark
                  ? 'bg-gray-700 border-gray-600 text-gray-400'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
                }
              `}
            >
              Lade Embedding-Modelle...
            </div>
          ) : embeddingError ? (
            <div
              className={`
                px-4 py-3 rounded-lg border text-sm
                ${isDark
                  ? 'bg-red-900/20 border-red-800 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-600'
                }
              `}
            >
              {embeddingError}
            </div>
          ) : embeddingModels.length === 0 ? (
            <div
              className={`
                px-4 py-3 rounded-lg border text-sm
                ${isDark
                  ? 'bg-yellow-900/20 border-yellow-800 text-yellow-400'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-600'
                }
              `}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Keine Embedding-Modelle gefunden. Installieren Sie z.B. <code className="font-mono">nomic-embed-text</code> mit <code className="font-mono">ollama pull nomic-embed-text</code>
            </div>
          ) : (
            <select
              value={settings.embeddingModel || ''}
              onChange={(e) => handleEmbeddingModelSelect(e.target.value)}
              className={`
                w-full px-4 py-3 rounded-lg border transition-all duration-200
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                cursor-pointer
                ${isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
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
          <p
            className={`
              text-xs
              ${isDark ? 'text-gray-400' : 'text-gray-600'}
            `}
          >
            Das Embedding-Modell wird für die semantische Dokumentensuche verwendet
          </p>
          <div
            className={`
              flex items-start gap-2 p-3 rounded-lg text-xs
              ${isDark ? 'bg-orange-900/20 text-orange-300' : 'bg-orange-50 text-orange-700'}
            `}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>Hinweis:</strong> Bei Änderung des Embedding-Modells müssen alle Dokumente
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
        <label className="block text-sm font-medium">
          <Scale className="w-4 h-4 inline mr-2" />
          Hybrid Search Balance
        </label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Keyword
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.hybridSearchAlpha ?? 0.5}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                updateSetting('hybridSearchAlpha', value);
                info(`Hybrid Search Balance: ${value === 0 ? 'Keyword (BM25)' : value === 1 ? 'Semantisch (Vector)' : `${Math.round(value * 100)}% Semantisch`}`);
              }}
              className={`
                flex-1 h-2 rounded-lg appearance-none cursor-pointer
                ${isDark
                  ? 'bg-gray-700 [&::-webkit-slider-thumb]:bg-purple-500'
                  : 'bg-gray-200 [&::-webkit-slider-thumb]:bg-purple-600'
                }
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-moz-range-thumb]:bg-purple-500
                [&::-moz-range-thumb]:border-none
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:cursor-pointer
              `}
              aria-label="Hybrid Search Balance zwischen Keyword und Semantischer Suche"
            />
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Semantic
            </span>
            <div
              className={`
                min-w-[60px] px-3 py-2 rounded-lg text-center text-sm font-mono
                ${isDark
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-900'
                }
              `}
            >
              {((settings.hybridSearchAlpha ?? 0.5) * 100).toFixed(0)}%
            </div>
          </div>
          <div
            className={`
              flex items-start gap-2 p-3 rounded-lg text-xs
              ${isDark ? 'bg-purple-900/20 text-purple-300' : 'bg-purple-50 text-purple-700'}
            `}
          >
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>Hybrid Search Balance:</strong><br />
              • 0% (Keyword): Exakte Wort-Übereinstimmung (BM25)<br />
              • 50% (Empfohlen): Ausgewogene Hybrid-Suche<br />
              • 100% (Semantic): Bedeutungsbasierte Vektor-Suche
            </div>
          </div>
        </div>
      </div>

      {/* Temperature Slider */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <Thermometer className="w-4 h-4 inline mr-2" />
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
                flex-1 h-2 rounded-lg appearance-none cursor-pointer
                ${isDark
                  ? 'bg-gray-700 [&::-webkit-slider-thumb]:bg-blue-500'
                  : 'bg-gray-200 [&::-webkit-slider-thumb]:bg-blue-600'
                }
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-moz-range-thumb]:bg-blue-500
                [&::-moz-range-thumb]:border-none
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:cursor-pointer
              `}
              aria-label="Temperatur für Textgenerierung"
            />
            <div
              className={`
                min-w-[60px] px-3 py-2 rounded-lg text-center text-sm font-mono
                ${isDark
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-900'
                }
              `}
            >
              {temperature.toFixed(1)}
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              0.0 (Deterministisch)
            </span>
            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              2.0 (Sehr kreativ)
            </span>
          </div>
          <div
            className={`
              flex items-start gap-2 p-3 rounded-lg text-xs
              ${isDark ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'}
            `}
          >
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>Temperatur-Werte:</strong><br />
              • 0.0-0.3: Präzise, vorhersagbare Antworten<br />
              • 0.4-0.8: Ausgewogene Kreativität (empfohlen)<br />
              • 0.9-2.0: Sehr kreative, unvorhersagbare Antworten
            </div>
          </div>
        </div>
      </div>

      {/* Max Tokens Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <Hash className="w-4 h-4 inline mr-2" />
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
                flex-1 px-4 py-3 rounded-lg border transition-all duration-200
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                font-mono text-sm
                ${isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }
              `}
              placeholder="4096"
              aria-label="Maximale Anzahl Tokens für Antworten"
            />
            <div className="flex gap-2">
              {[1024, 2048, 4096, 8192].map((value) => (
                <button
                  key={value}
                  onClick={() => handleMaxTokensChange(value)}
                  className={`
                    px-3 py-2 text-xs rounded-lg transition-colors
                    ${maxTokens === value
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                  aria-label={`Max Tokens auf ${value} setzen`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <p
            className={`
              text-xs
              ${isDark ? 'text-gray-400' : 'text-gray-600'}
            `}
          >
            Begrenzt die Länge der generierten Antworten (1 Token ≈ 0,75 Wörter)
          </p>
        </div>
      </div>

      {/* Divider */}
      <hr className={`${isDark ? 'border-gray-700' : 'border-gray-200'}`} />

      {/* System Prompt Textarea */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <MessageSquare className="w-4 h-4 inline mr-2" />
          System-Prompt
        </label>
        <div className="space-y-3">
          <textarea
            value={settings.systemPrompt || ''}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder="Geben Sie hier einen System-Prompt ein, um das Verhalten der KI zu beeinflussen..."
            rows={6}
            className={`
              w-full px-4 py-3 rounded-lg border transition-all duration-200
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              resize-vertical
              ${isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }
            `}
            aria-label="System-Prompt für KI-Verhalten"
          />
          <div
            className={`
              flex items-start gap-2 p-3 rounded-lg text-xs
              ${isDark ? 'bg-yellow-900/20 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}
            `}
          >
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>System-Prompt:</strong> Definiert das Grundverhalten und die Rolle der KI.
              Beispiele: "Du bist ein hilfreicher Assistent für Programmierung" oder
              "Antworte immer sehr kurz und präzise". Leer lassen für Standard-Verhalten.
            </div>
          </div>
          {settings.systemPrompt && settings.systemPrompt.trim() && (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {settings.systemPrompt.length} Zeichen
              </span>
              <button
                onClick={() => handleSystemPromptChange('')}
                className={`
                  text-xs px-2 py-1 rounded transition-colors
                  ${isDark
                    ? 'text-red-400 hover:bg-red-900/20'
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