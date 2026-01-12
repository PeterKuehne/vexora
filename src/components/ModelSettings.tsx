/**
 * ModelSettings Component
 *
 * Model settings tab component with:
 * - Default Model Selector
 * - Temperature Slider (0-2)
 * - System Prompt Textarea
 * - Max Tokens Input
 * - Generation Parameters Management
 */

import { useState, useEffect } from 'react';
import { Cpu, Thermometer, MessageSquare, Hash, Info } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { ModelSelector } from './ModelSelector';

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
  const { info } = useToast();

  // Local state for generation parameters (not persisted yet)
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Load initial system prompt from settings
  useEffect(() => {
    // Temperature and maxTokens will come from generation params context in the future
    setTemperature(0.7);
    setMaxTokens(4096);
  }, []);

  /**
   * Handle default model change
   */
  const handleDefaultModelChange = (modelId: string) => {
    updateSetting('defaultModel', modelId);
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

      {/* Default Model Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <Cpu className="w-4 h-4 inline mr-2" />
          Standard-Modell
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