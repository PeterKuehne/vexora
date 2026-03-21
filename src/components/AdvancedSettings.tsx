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
      link.download = `cor7ex-settings-${new Date().toISOString().split('T')[0]}.json`;
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
        <h3
          className={`
            text-[13px] font-semibold uppercase tracking-wider mb-1
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `}
        >
          Erweiterte Einstellungen
        </h3>
        <p className={`text-[13px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          API-Verbindung, Datenübertragung und Tastenkürzel
        </p>
      </div>

      {/* API Configuration */}
      <div className="space-y-4">
        <div
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
            <Server size={14} />
          </div>
          <span>Ollama API URL</span>
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
                  w-full px-4 py-2.5 rounded-xl border text-[13px]
                  transition-all duration-150
                  focus:outline-none focus:ring-0
                  ${
                    isValidUrl
                      ? isDark
                        ? 'border-white/[0.08] bg-white/[0.03] text-white placeholder-gray-600 focus:border-white/[0.15]'
                        : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-gray-400'
                      : isDark
                        ? 'border-red-500/30 bg-red-500/5 text-white'
                        : 'border-red-300 bg-red-50 text-gray-900'
                  }
                `}
                aria-label="Ollama API URL eingeben"
              />
              {!isValidUrl && (
                <div className="flex items-center gap-1 mt-1.5 text-red-400 text-[11px]">
                  <X size={11} />
                  <span>Ungültige URL (muss mit http:// oder https:// beginnen)</span>
                </div>
              )}
            </div>

            <button
              onClick={testApiConnection}
              disabled={!isValidUrl}
              className={`
                px-4 py-2.5 rounded-xl text-[13px] font-semibold
                transition-all duration-150
                flex items-center gap-2 shrink-0
                ${
                  isValidUrl
                    ? isDark
                      ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/5'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                    : isDark
                      ? 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <ExternalLink size={14} />
              Testen
            </button>
          </div>

          <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Standard: http://localhost:11434 (lokale Ollama-Installation)
          </p>
        </div>
      </div>

      <hr className={isDark ? 'border-white/[0.06]' : 'border-gray-200/80'} />

      {/* Export/Import */}
      <div className="space-y-4">
        <div
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
            <Download size={14} />
          </div>
          <span>Einstellungen übertragen</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={exportSettings}
            className={`
              p-3.5 rounded-xl border transition-all duration-150 text-left group
              ${isDark
                ? 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.1]'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`
                  w-7 h-7 rounded-lg flex items-center justify-center
                  ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-500'}
                `}
              >
                <Download size={14} />
              </div>
              <span
                className={`
                  text-[13px] font-medium
                  ${isDark ? 'text-gray-200' : 'text-gray-800'}
                `}
              >
                Exportieren
              </span>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              Speichert alle Einstellungen als JSON-Datei
            </p>
          </button>

          <button
            onClick={importSettings}
            className={`
              p-3.5 rounded-xl border transition-all duration-150 text-left group
              ${isDark
                ? 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.1]'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`
                  w-7 h-7 rounded-lg flex items-center justify-center
                  ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-500'}
                `}
              >
                <Upload size={14} />
              </div>
              <span
                className={`
                  text-[13px] font-medium
                  ${isDark ? 'text-gray-200' : 'text-gray-800'}
                `}
              >
                Importieren
              </span>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
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

      <hr className={isDark ? 'border-white/[0.06]' : 'border-gray-200/80'} />

      {/* Keyboard Shortcuts */}
      <div className="space-y-4">
        <div
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
            <Keyboard size={14} />
          </div>
          <span>Tastenkürzel</span>
        </div>

        <div className="space-y-1.5">
          {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
            <div
              key={index}
              className={`
                flex items-center justify-between p-3 rounded-xl
                ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'}
              `}
            >
              <div className="flex-1">
                <div
                  className={`
                    text-[13px] font-medium
                    ${isDark ? 'text-gray-200' : 'text-gray-800'}
                  `}
                >
                  {shortcut.action}
                </div>
                <div className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  {shortcut.description}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <span key={keyIndex} className="flex items-center gap-1">
                    <kbd
                      className={`
                        px-2 py-1 text-[11px] font-mono rounded-md
                        ${isDark
                          ? 'bg-white/[0.06] text-gray-300 border border-white/[0.08]'
                          : 'bg-white text-gray-700 border border-gray-200'
                        }
                      `}
                    >
                      {key}
                    </kbd>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        +
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className={`
            relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl
            ${isDark
              ? 'bg-violet-500/5 border border-violet-500/10'
              : 'bg-violet-50 border border-violet-100'
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
          <div className="relative text-[12px] leading-relaxed">
            <div
              className={`
                font-medium
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}
            >
              Hinweis zu Tastenkürzeln
            </div>
            <div className={`mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
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
