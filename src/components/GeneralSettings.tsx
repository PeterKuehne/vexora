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
        <h3
          className={`
            text-[13px] font-semibold uppercase tracking-wider mb-1
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `}
        >
          Allgemeine Einstellungen
        </h3>
        <p className={`text-[13px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          Theme, Auto-Speichern und Datenverwaltung
        </p>
      </div>

      {/* Theme Selector */}
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
            <Save size={14} />
          </div>
          Theme
        </label>
        <div className="relative">
          <select
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as Theme)}
            className={`
              w-full px-4 py-2.5 pr-10 rounded-xl
              border transition-all duration-150
              focus:outline-none focus:ring-0
              appearance-none cursor-pointer text-[13px]
              ${isDark
                ? 'bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.05] focus:border-white/[0.15]'
                : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 focus:border-gray-400'
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
              className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
            />
          </div>
        </div>
        <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          Das System-Theme folgt den Einstellungen deines Betriebssystems
        </p>
      </div>

      {/* Auto-Save Toggle */}
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
            <Save size={14} />
          </div>
          Auto-Speichern
        </label>
        <div
          className={`
            flex items-center justify-between p-3 rounded-xl
            ${isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-gray-50 border border-gray-200/80'}
          `}
        >
          <div>
            <p className={`text-[13px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Automatisches Speichern von Unterhaltungen
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
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
                relative w-10 h-[22px] rounded-full transition-colors duration-200
                ${(settings.autoSave || false)
                  ? 'bg-blue-500'
                  : isDark ? 'bg-white/[0.08]' : 'bg-gray-300'
                }
              `}
            >
              <div
                className={`
                  absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full
                  transition-transform duration-200 ease-in-out shadow-sm
                  ${(settings.autoSave || false) ? 'translate-x-[18px]' : 'translate-x-0'}
                `}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Divider */}
      <hr className={isDark ? 'border-white/[0.06]' : 'border-gray-200/80'} />

      {/* Clear All Section */}
      <div className="space-y-4">
        <label
          className={`
            flex items-center gap-2 text-[13px] font-medium
            ${isDark ? 'text-gray-300' : 'text-gray-700'}
          `}
        >
          <div
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'}
            `}
          >
            <Trash2 size={14} />
          </div>
          Datenverwaltung
        </label>

        {!showClearConfirm ? (
          <div className="space-y-3">
            <p className={`text-[13px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Alle gespeicherten Unterhaltungen dauerhaft löschen
            </p>
            <button
              onClick={handleClearAll}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl
                text-[13px] font-medium transition-all duration-150
                border
                ${isDark
                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50'
                  : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                }
              `}
              aria-label="Alle Unterhaltungen löschen"
            >
              <Trash2 size={14} />
              Alle Unterhaltungen löschen
            </button>
          </div>
        ) : (
          <div
            className={`
              p-4 rounded-xl border
              ${isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-red-50'}
            `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                  ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-500'}
                `}
              >
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1">
                <h4
                  className={`
                    text-[13px] font-semibold
                    ${isDark ? 'text-red-300' : 'text-red-800'}
                  `}
                >
                  Sind Sie sicher?
                </h4>
                <p
                  className={`
                    text-[12px] mt-1 leading-relaxed
                    ${isDark ? 'text-red-300/70' : 'text-red-700'}
                  `}
                >
                  Diese Aktion kann nicht rückgängig gemacht werden. Alle Unterhaltungen und deren Nachrichten werden dauerhaft gelöscht.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleClearAll}
                    disabled={isClearing}
                    className={`
                      px-3 py-1.5 text-[13px] font-medium rounded-xl
                      transition-all duration-150
                      ${isClearing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-red-500/80 hover:bg-red-500 text-white'
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
                      px-3 py-1.5 text-[13px] font-medium rounded-xl
                      transition-all duration-150 border
                      ${isDark
                        ? 'border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100'
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
