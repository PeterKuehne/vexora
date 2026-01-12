/**
 * GeneralSettings Component
 *
 * General settings tab component with:
 * - Theme Selector dropdown
 * - Auto-save Toggle switch
 * - Clear All Button with confirmation dialog
 */

import { useState } from 'react';
import { ChevronDown, Trash2, Save, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { conversationStorage } from '../lib/conversationStorage';
import { useToast } from '../contexts/ToastContext';
import type { Theme } from '../types/settings';

export interface GeneralSettingsProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * General Settings tab content component
 */
export function GeneralSettings({ className = '' }: GeneralSettingsProps) {
  const { isDark, theme, setTheme } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { info, success: showSuccess, error: showError } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  /**
   * Theme options for the dropdown selector
   */
  const themeOptions = [
    { value: 'light' as Theme, label: 'Hell', icon: '☀️' },
    { value: 'dark' as Theme, label: 'Dunkel', icon: '🌙' },
    { value: 'system' as Theme, label: 'System', icon: '💻' },
  ];

  /**
   * Handle theme change from dropdown
   */
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    info(`Theme wurde auf "${themeOptions.find(t => t.value === newTheme)?.label}" geändert`);
  };

  /**
   * Handle auto-save toggle
   */
  const handleAutoSaveToggle = (enabled: boolean) => {
    updateSetting('autoSave', enabled);
    info(enabled ? 'Auto-Speichern aktiviert' : 'Auto-Speichern deaktiviert');
  };

  /**
   * Handle clear all conversations with confirmation
   */
  const handleClearAll = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setIsClearing(true);
    try {
      const success = conversationStorage.clearAll();
      if (success) {
        showSuccess('Alle Unterhaltungen wurden gelöscht');
        // Reload page to reset conversation state
        window.location.reload();
      } else {
        showError('Fehler beim Löschen der Unterhaltungen');
      }
    } catch (err) {
      console.error('Failed to clear conversations:', err);
      showError('Fehler beim Löschen der Unterhaltungen');
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  /**
   * Cancel clear all action
   */
  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium mb-2">Allgemeine Einstellungen</h3>
        <p
          className={`
            text-sm
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}
        >
          Theme, Auto-Speichern und Datenverwaltung
        </p>
      </div>

      {/* Theme Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <Save className="w-4 h-4 inline mr-2" />
          Theme
        </label>
        <div className="relative">
          <select
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as Theme)}
            className={`
              w-full px-4 py-3 pr-10 rounded-lg
              border transition-all duration-200
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              appearance-none cursor-pointer
              ${isDark
                ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-650'
                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
              }
            `}
            aria-label="Theme auswählen"
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.icon} {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown
              className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            />
          </div>
        </div>
        <p
          className={`
            text-xs
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}
        >
          Das System-Theme folgt den Einstellungen deines Betriebssystems
        </p>
      </div>

      {/* Auto-Save Toggle */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <Save className="w-4 h-4 inline mr-2" />
          Auto-Speichern
        </label>
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`
                text-sm
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}
            >
              Automatisches Speichern von Unterhaltungen
            </p>
            <p
              className={`
                text-xs mt-1
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}
            >
              Speichere Änderungen automatisch während der Eingabe
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSave || false}
              onChange={(e) => handleAutoSaveToggle(e.target.checked)}
              className="sr-only"
              aria-label="Auto-Speichern aktivieren/deaktivieren"
            />
            <div
              className={`
                relative w-11 h-6 rounded-full transition-colors duration-200
                ${(settings.autoSave || false)
                  ? 'bg-blue-600'
                  : isDark ? 'bg-gray-600' : 'bg-gray-300'
                }
              `}
            >
              <div
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full
                  transition-transform duration-200 ease-in-out
                  ${(settings.autoSave || false) ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Divider */}
      <hr className={`${isDark ? 'border-gray-700' : 'border-gray-200'}`} />

      {/* Clear All Section */}
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          <Trash2 className="w-4 h-4 inline mr-2" />
          Datenverwaltung
        </label>

        {!showClearConfirm ? (
          <div className="space-y-3">
            <p
              className={`
                text-sm
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}
            >
              Alle gespeicherten Unterhaltungen dauerhaft löschen
            </p>
            <button
              onClick={handleClearAll}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg
                text-sm font-medium transition-colors
                border
                ${isDark
                  ? 'border-red-600 text-red-400 hover:bg-red-600 hover:text-white'
                  : 'border-red-500 text-red-600 hover:bg-red-500 hover:text-white'
                }
              `}
              aria-label="Alle Unterhaltungen löschen"
            >
              <Trash2 className="w-4 h-4" />
              Alle Unterhaltungen löschen
            </button>
          </div>
        ) : (
          <div
            className={`
              p-4 rounded-lg border-2
              ${isDark ? 'border-red-600 bg-red-900/20' : 'border-red-500 bg-red-50'}
            `}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`
                  w-5 h-5 mt-0.5 shrink-0
                  ${isDark ? 'text-red-400' : 'text-red-500'}
                `}
              />
              <div className="flex-1">
                <h4
                  className={`
                    font-medium text-sm
                    ${isDark ? 'text-red-300' : 'text-red-800'}
                  `}
                >
                  Sind Sie sicher?
                </h4>
                <p
                  className={`
                    text-sm mt-1
                    ${isDark ? 'text-red-200' : 'text-red-700'}
                  `}
                >
                  Diese Aktion kann nicht rückgängig gemacht werden. Alle Unterhaltungen und deren Nachrichten werden dauerhaft gelöscht.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleClearAll}
                    disabled={isClearing}
                    className={`
                      px-3 py-2 text-sm font-medium rounded-lg
                      transition-colors
                      ${isClearing
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : isDark
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }
                    `}
                    aria-label="Löschen bestätigen"
                  >
                    {isClearing ? 'Wird gelöscht...' : 'Ja, löschen'}
                  </button>
                  <button
                    onClick={handleCancelClear}
                    disabled={isClearing}
                    className={`
                      px-3 py-2 text-sm font-medium rounded-lg
                      transition-colors border
                      ${isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }
                    `}
                    aria-label="Löschen abbrechen"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GeneralSettings;