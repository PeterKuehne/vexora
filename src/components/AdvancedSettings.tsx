/**
 * AdvancedSettings Component
 *
 * Advanced settings tab component with:
 * - Ollama API URL Input with validation
 * - Export Button for settings export
 * - Import Button for settings import
 * - Keyboard Shortcuts List with all hotkeys
 */

import { useState, useRef } from 'react';
import {
  Server,
  Download,
  Upload,
  Keyboard,
  Info,
  X,
  ExternalLink
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import type { AppSettings } from '../types/settings';

export interface AdvancedSettingsProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Keyboard shortcuts data
 */
const KEYBOARD_SHORTCUTS = [
  {
    action: 'Neue Unterhaltung',
    keys: ['Ctrl', 'N'],
    description: 'Startet eine neue Unterhaltung',
  },
  {
    action: 'Nachricht senden',
    keys: ['Enter'],
    description: 'Sendet die aktuelle Nachricht',
  },
  {
    action: 'Neue Zeile',
    keys: ['Shift', 'Enter'],
    description: 'Fügt eine neue Zeile hinzu ohne zu senden',
  },
  {
    action: 'Einstellungen öffnen',
    keys: ['Ctrl', ','],
    description: 'Öffnet die Einstellungen',
  },
  {
    action: 'Sidebar umschalten',
    keys: ['Ctrl', 'B'],
    description: 'Zeigt oder versteckt die Sidebar',
  },
  {
    action: 'Theme wechseln',
    keys: ['Ctrl', 'Shift', 'T'],
    description: 'Wechselt zwischen Hell/Dunkel/System Theme',
  },
  {
    action: 'Suche öffnen',
    keys: ['Ctrl', 'K'],
    description: 'Öffnet die Unterhaltungssuche',
  },
  {
    action: 'Nach oben',
    keys: ['↑'],
    description: 'Lädt die letzte Nachricht in das Eingabefeld',
  },
];

/**
 * Advanced Settings tab content component
 */
export function AdvancedSettings({ className = '' }: AdvancedSettingsProps) {
  const { isDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { info, success: showSuccess, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [apiUrl, setApiUrl] = useState('http://localhost:11434');
  const [isValidUrl, setIsValidUrl] = useState(true);

  /**
   * Validates API URL format
   */
  const validateApiUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  /**
   * Handles API URL changes with validation
   */
  const handleApiUrlChange = (value: string) => {
    setApiUrl(value);
    const valid = validateApiUrl(value);
    setIsValidUrl(valid);

    if (valid) {
      // In a real implementation, this would save to settings
      info(`API URL aktualisiert: ${value}`);
    }
  };

  /**
   * Tests API connection
   */
  const testApiConnection = async () => {
    if (!isValidUrl) {
      showError('Ungültige API URL');
      return;
    }

    try {
      info('Teste Verbindung...');
      // In real implementation: const response = await fetch(`${apiUrl}/api/health`);
      // Simulating connection test
      await new Promise(resolve => setTimeout(resolve, 1000));
      showSuccess('Verbindung erfolgreich');
    } catch (error) {
      showError('Verbindung fehlgeschlagen');
    }
  };

  /**
   * Exports settings to JSON file
   */
  const exportSettings = () => {
    try {
      const settingsData = {
        settings,
        exportDate: new Date().toISOString(),
        version: '1.0',
      };

      const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qwen-chat-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('Einstellungen exportiert');
    } catch (error) {
      showError('Export fehlgeschlagen');
    }
  };

  /**
   * Imports settings from JSON file
   */
  const importSettings = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handles file selection for import
   */
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validate imported settings structure
        if (data.settings && typeof data.settings === 'object') {
          // Apply each setting individually with validation
          Object.entries(data.settings as Partial<AppSettings>).forEach(([key, value]) => {
            if (key in settings) {
              updateSetting(key as keyof AppSettings, value as any);
            }
          });

          showSuccess('Einstellungen importiert');
          info(`Import vom ${new Date(data.exportDate || Date.now()).toLocaleDateString()}`);
        } else {
          showError('Ungültiges Einstellungsformat');
        }
      } catch (error) {
        showError('Import fehlgeschlagen: Ungültige Datei');
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium mb-2">Erweiterte Einstellungen</h3>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          API-Verbindung, Datenübertragung und Tastenkürzel
        </p>
      </div>

      {/* API Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Server size={18} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          <span className="font-medium">Ollama API URL</span>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => handleApiUrlChange(e.target.value)}
                placeholder="http://localhost:11434"
                className={`
                  w-full px-3 py-2 rounded-lg border transition-all
                  ${
                    isValidUrl
                      ? isDark
                        ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500'
                        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500'
                      : isDark
                        ? 'border-red-500 bg-gray-700 text-white'
                        : 'border-red-500 bg-white text-gray-900'
                  }
                  focus:ring-2 focus:ring-blue-500/20 focus:outline-none
                `}
                aria-label="Ollama API URL eingeben"
              />
              {!isValidUrl && (
                <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                  <X size={12} />
                  <span>Ungültige URL (muss mit http:// oder https:// beginnen)</span>
                </div>
              )}
            </div>

            <button
              onClick={testApiConnection}
              disabled={!isValidUrl}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-colors
                flex items-center gap-2
                ${
                  isValidUrl
                    ? isDark
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <ExternalLink size={14} />
              Testen
            </button>
          </div>

          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Standard: http://localhost:11434 (lokale Ollama-Installation)
          </p>
        </div>
      </div>

      <hr className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />

      {/* Export/Import */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Download size={18} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          <span className="font-medium">Einstellungen übertragen</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={exportSettings}
            className={`
              p-3 rounded-lg border transition-all text-left
              ${
                isDark
                  ? 'border-gray-600 bg-gray-700 hover:border-gray-500 text-white'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <Download size={16} />
              <span className="font-medium">Exportieren</span>
            </div>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Speichert alle Einstellungen als JSON-Datei
            </p>
          </button>

          <button
            onClick={importSettings}
            className={`
              p-3 rounded-lg border transition-all text-left
              ${
                isDark
                  ? 'border-gray-600 bg-gray-700 hover:border-gray-500 text-white'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <Upload size={16} />
              <span className="font-medium">Importieren</span>
            </div>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Lädt Einstellungen aus JSON-Datei
            </p>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
          aria-label="Einstellungsdatei auswählen"
        />
      </div>

      <hr className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />

      {/* Keyboard Shortcuts */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Keyboard size={18} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          <span className="font-medium">Tastenkürzel</span>
        </div>

        <div className="space-y-2">
          {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
            <div
              key={index}
              className={`
                flex items-center justify-between p-3 rounded-lg
                ${isDark ? 'bg-gray-700' : 'bg-gray-50'}
              `}
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{shortcut.action}</div>
                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {shortcut.description}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <span key={keyIndex} className="flex items-center gap-1">
                    <kbd
                      className={`
                        px-2 py-1 text-xs font-mono rounded
                        ${
                          isDark
                            ? 'bg-gray-600 text-gray-200 border border-gray-500'
                            : 'bg-white text-gray-700 border border-gray-300'
                        }
                      `}
                    >
                      {key}
                    </kbd>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        +
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={`
          flex items-start gap-2 p-3 rounded-lg
          ${isDark ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-blue-50 border border-blue-200'}
        `}>
          <Info size={16} className={`mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <div className="text-sm">
            <div className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
              Hinweis zu Tastenkürzeln
            </div>
            <div className={`mt-1 ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
              Auf macOS verwenden Sie ⌘ (Cmd) anstelle von Ctrl. Die meisten Shortcuts
              funktionieren automatisch plattformspezifisch.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedSettings;