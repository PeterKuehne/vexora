/**
 * SettingsModal Component
 * Modal dialog for application settings using Headless UI
 * Features tab navigation, form controls, and responsive design
 */

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { X, Settings, Palette, Keyboard, Sliders, Cloud } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings, useFontSize } from '../contexts/SettingsContext';
import { useAuth } from '../contexts';
import { GeneralSettings } from './GeneralSettings';
import { ModelSettings } from './ModelSettings';
import { AdvancedSettings } from './AdvancedSettings';
import { ConfirmDialog } from './ConfirmDialog';
import type { Theme, FontSize } from '../types/settings';

export interface SettingsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
}

/**
 * Tab data structure for settings categories
 */
interface SettingsTab {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'general',
    name: 'Allgemein',
    icon: Settings,
    description: 'Grundlegende App-Einstellungen',
  },
  {
    id: 'appearance',
    name: 'Darstellung',
    icon: Palette,
    description: 'Theme und visuelle Einstellungen',
  },
  {
    id: 'behavior',
    name: 'Verhalten',
    icon: Keyboard,
    description: 'API, Export/Import und Shortcuts',
  },
  {
    id: 'advanced',
    name: 'Erweitert',
    icon: Sliders,
    description: 'Erweiterte Modell-Parameter',
  },
  {
    id: 'providers',
    name: 'AI Provider',
    icon: Cloud,
    description: 'Cloud-Modelle & PII Guard',
  },
];

/**
 * Settings Modal with tabbed interface
 */
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { settings, updateSetting, resetSettings } = useSettings();
  const isAdmin = user?.role === 'Admin';

  // Filter tabs: AI Provider only for Admins
  const visibleTabs = isAdmin ? SETTINGS_TABS : SETTINGS_TABS.filter(t => t.id !== 'providers');
  const { fontSize, setFontSize, fontSizeClass } = useFontSize();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleThemeChange = (newTheme: Theme) => {
    updateSetting('theme', newTheme);
  };

  const handleFontSizeChange = (newSize: FontSize) => {
    setFontSize(newSize);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = () => {
    resetSettings();
    setShowResetConfirm(false);
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className={`
              fixed inset-0 backdrop-blur-sm
              ${isDark ? 'bg-black/60' : 'bg-gray-900/50'}
            `}
          />
        </Transition.Child>

        {/* Modal Container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`
                  w-full max-w-4xl
                  rounded-2xl shadow-2xl
                  transform overflow-hidden
                  transition-all
                  ${isDark
                    ? 'bg-neutral-900 text-white border border-white/[0.06]'
                    : 'bg-white text-gray-900 border border-gray-200/80'
                  }
                `}
              >
                {/* Header */}
                <div
                  className={`
                    animate-stagger-1
                    flex items-center justify-between
                    px-6 py-4
                    border-b
                    ${isDark ? 'border-white/[0.06]' : 'border-gray-200/80'}
                  `}
                >
                  <Dialog.Title
                    as="h2"
                    className={`
                      text-[15px] font-semibold tracking-tight
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}
                  >
                    Einstellungen
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className={`
                      p-1.5 rounded-xl
                      transition-colors duration-150
                      ${isDark
                        ? 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.06]'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
                      }
                    `}
                    title="Schließen"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tab Navigation */}
                <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
                  <div className="flex">
                    {/* Tab List - Sidebar */}
                    <div
                      className={`
                        animate-stagger-2
                        w-56 shrink-0
                        border-r
                        ${isDark ? 'border-white/[0.06]' : 'border-gray-200/80'}
                      `}
                    >
                      <Tab.List className="flex flex-col p-2 gap-0.5">
                        {visibleTabs.map((tab) => (
                          <Tab key={tab.id} as={Fragment}>
                            {({ selected }) => (
                              <button
                                className={`
                                  relative w-full flex items-center gap-3
                                  px-3 py-2.5 text-left
                                  rounded-xl transition-all duration-150
                                  ${selected
                                    ? isDark
                                      ? 'bg-white/[0.06] text-white'
                                      : 'bg-black/[0.04] text-gray-900'
                                    : isDark
                                      ? 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                                      : 'text-gray-500 hover:text-gray-700 hover:bg-black/[0.02]'
                                  }
                                `}
                              >
                                {/* Left accent bar */}
                                {selected && (
                                  <div
                                    className={`
                                      absolute left-0 top-1/2 -translate-y-1/2
                                      w-[3px] h-5 rounded-r-full
                                      ${isDark ? 'bg-white/60' : 'bg-gray-900/60'}
                                    `}
                                  />
                                )}
                                {/* Icon container */}
                                <div
                                  className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                                    transition-colors duration-150
                                    ${selected
                                      ? isDark
                                        ? 'bg-white/[0.08] text-white'
                                        : 'bg-black/[0.06] text-gray-900'
                                      : isDark
                                        ? 'bg-white/[0.03] text-gray-500'
                                        : 'bg-black/[0.02] text-gray-400'
                                    }
                                  `}
                                >
                                  <tab.icon size={15} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[13px] font-medium">{tab.name}</div>
                                  <div
                                    className={`
                                      text-[11px] truncate
                                      ${isDark ? 'text-gray-600' : 'text-gray-400'}
                                    `}
                                  >
                                    {tab.description}
                                  </div>
                                </div>
                              </button>
                            )}
                          </Tab>
                        ))}
                      </Tab.List>
                    </div>

                    {/* Tab Panels - Content */}
                    <div className="animate-stagger-3 flex-1 p-6 overflow-y-auto max-h-[65vh]">
                      <Tab.Panels className="focus:outline-none">
                        {/* General Settings */}
                        <Tab.Panel className="focus:outline-none">
                          <GeneralSettings />
                        </Tab.Panel>

                        {/* Appearance Settings */}
                        <Tab.Panel className="space-y-6 focus:outline-none">
                          <div>
                            <h3
                              className={`
                                text-[13px] font-semibold uppercase tracking-wider mb-5
                                ${isDark ? 'text-gray-400' : 'text-gray-500'}
                              `}
                            >
                              Darstellung
                            </h3>

                            {/* Theme */}
                            <div className="space-y-3">
                              <label
                                className={`
                                  block text-[13px] font-medium
                                  ${isDark ? 'text-gray-300' : 'text-gray-700'}
                                `}
                              >
                                Design
                              </label>
                              <div className="flex gap-2">
                                {(['light', 'dark', 'system'] as Theme[]).map((theme) => (
                                  <button
                                    key={theme}
                                    onClick={() => handleThemeChange(theme)}
                                    className={`
                                      px-4 py-2 rounded-xl
                                      border text-[13px] font-medium
                                      transition-all duration-150
                                      ${settings.theme === theme
                                        ? isDark
                                          ? 'bg-white text-gray-900 border-white/20'
                                          : 'bg-gray-900 text-white border-gray-900'
                                        : isDark
                                          ? 'border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04]'
                                          : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-black/[0.02]'
                                      }
                                    `}
                                  >
                                    {theme === 'light' ? 'Hell' : theme === 'dark' ? 'Dunkel' : 'System'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Font Size */}
                            <div className="space-y-3 mt-6">
                              <label
                                className={`
                                  block text-[13px] font-medium
                                  ${isDark ? 'text-gray-300' : 'text-gray-700'}
                                `}
                              >
                                Schriftgröße
                              </label>
                              <div className="flex gap-2">
                                {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                                  <button
                                    key={size}
                                    onClick={() => handleFontSizeChange(size)}
                                    className={`
                                      px-4 py-2 rounded-xl
                                      border text-[13px] font-medium
                                      transition-all duration-150
                                      ${fontSize === size
                                        ? isDark
                                          ? 'bg-white text-gray-900 border-white/20'
                                          : 'bg-gray-900 text-white border-gray-900'
                                        : isDark
                                          ? 'border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04]'
                                          : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-black/[0.02]'
                                      }
                                    `}
                                  >
                                    {size === 'small' ? 'Klein' : size === 'medium' ? 'Mittel' : 'Groß'}
                                  </button>
                                ))}
                              </div>
                              <div
                                className={`
                                  text-sm ${fontSizeClass}
                                  ${isDark ? 'text-gray-500' : 'text-gray-400'}
                                `}
                              >
                                Beispieltext in der gewählten Schriftgröße
                              </div>
                            </div>
                          </div>
                        </Tab.Panel>

                        {/* Advanced Settings */}
                        <Tab.Panel className="focus:outline-none">
                          <AdvancedSettings />
                        </Tab.Panel>

                        {/* Model Settings */}
                        <Tab.Panel className="focus:outline-none">
                          <ModelSettings />
                        </Tab.Panel>

                        {/* AI Provider Settings (Admin only) */}
                        {isAdmin && <Tab.Panel className="focus:outline-none space-y-6">
                          <div>
                            <h3
                              className={`
                                text-[13px] font-semibold uppercase tracking-wider mb-5
                                ${isDark ? 'text-gray-400' : 'text-gray-500'}
                              `}
                            >
                              AI Provider
                            </h3>

                            {/* Info Box */}
                            <div className={`rounded-xl p-4 mb-6 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                              <p className={`text-[13px] ${isDark ? 'text-blue-300/80' : 'text-blue-700'}`}>
                                Cloud-Modelle (wie Claude) senden Daten an externe Server.
                                Der PII Guard maskiert persoenliche Daten automatisch vor dem Senden.
                              </p>
                            </div>

                            {/* Anthropic API Key */}
                            <div className="space-y-2 mb-6">
                              <label className={`block text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Anthropic API Key
                              </label>
                              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-gray-50 border-gray-200'}`}>
                                <Cloud size={14} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                                <input
                                  type="password"
                                  placeholder="sk-ant-..."
                                  disabled
                                  className={`flex-1 bg-transparent text-[13px] outline-none ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'}`}
                                />
                              </div>
                              <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                Wird serverseitig konfiguriert (ANTHROPIC_API_KEY in .env)
                              </p>
                            </div>

                            {/* PII Guard Status */}
                            <div className="space-y-2 mb-6">
                              <label className={`block text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                PII Guard (Presidio)
                              </label>
                              <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-gray-50 border-gray-200'}`}>
                                <div className={`w-2 h-2 rounded-full bg-green-500`} />
                                <span className={`text-[13px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  PII-Erkennung aktiv (Presidio auf Ubuntu-Server)
                                </span>
                              </div>
                              <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                Erkennt automatisch: Personennamen, E-Mail-Adressen, IBANs, Telefonnummern, Steuer-IDs
                              </p>
                            </div>

                            {/* Usage Dashboard */}
                            <UsageDashboard isDark={isDark} />
                          </div>
                        </Tab.Panel>}
                      </Tab.Panels>
                    </div>
                  </div>
                </Tab.Group>

                {/* Footer */}
                <div
                  className={`
                    animate-stagger-4
                    flex items-center justify-between
                    px-6 py-3.5
                    border-t
                    ${isDark ? 'border-white/[0.06]' : 'border-gray-200/80'}
                  `}
                >
                  <button
                    onClick={handleReset}
                    className={`
                      px-4 py-2 rounded-xl
                      text-[13px] font-medium
                      border transition-all duration-150
                      ${isDark
                        ? 'border-white/[0.08] text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                        : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-black/[0.02]'
                      }
                    `}
                  >
                    Zurücksetzen
                  </button>

                  <button
                    onClick={onClose}
                    className={`
                      px-5 py-2 rounded-xl
                      text-[13px] font-semibold
                      transition-all duration-150
                      ${isDark
                        ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/5'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                      }
                    `}
                  >
                    Schließen
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Einstellungen zurücksetzen"
        message="Möchten Sie alle Einstellungen auf die Standardwerte zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmText="Zurücksetzen"
        cancelText="Abbrechen"
        confirmVariant="danger"
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />
    </Transition>
  );
}

/**
 * UsageDashboard - Shows API usage and costs for current month
 */
function UsageDashboard({ isDark }: { isDark: boolean }) {
  const [usage, setUsage] = useState<{
    summary: { totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalCostUsd: number; piiMaskedCount: number };
    perModel: Array<{ provider: string; model: string; requests: number; costUsd: number }>;
    period: { label: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        const { api } = await import('../lib/httpClient');
        const data = await api.get<any>(`${(await import('../lib/env')).env.API_URL}/api/admin/usage`);
        setUsage(data);
      } catch {
        // Usage endpoint may not exist yet (table not migrated)
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  return (
    <div className="space-y-2">
      <label className={`block text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        API-Verbrauch {usage?.period?.label ? `(${usage.period.label})` : ''}
      </label>

      {loading ? (
        <div className={`text-[12px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Lade...</div>
      ) : !usage ? (
        <div className={`rounded-xl border px-4 py-3 text-[12px] ${isDark ? 'bg-white/[0.03] border-white/[0.08] text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
          Noch keine Cloud-API-Nutzung vorhanden.
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.08]' : 'border-gray-200'}`}>
          {/* Summary row */}
          <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-4 text-[12px]">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                {usage.summary.totalRequests} Anfragen
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                {((usage.summary.totalInputTokens + usage.summary.totalOutputTokens) / 1000).toFixed(1)}K Tokens
              </span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                {usage.summary.piiMaskedCount} PII-maskiert
              </span>
            </div>
            <span className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ${usage.summary.totalCostUsd.toFixed(4)}
            </span>
          </div>

          {/* Per-model breakdown */}
          {usage.perModel.length > 0 && (
            <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
              {usage.perModel.map((m, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-2 text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span>{m.provider}:{m.model} ({m.requests}x)</span>
                  <span>${m.costUsd.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Settings Modal for smaller screens
 */
export interface SettingsModalCompactProps extends SettingsModalProps {
  /** Whether to show in compact mode */
  compact?: boolean;
}

export function SettingsModalCompact({
  isOpen,
  onClose,
  compact = false
}: SettingsModalCompactProps) {
  if (compact) {
    return <SettingsModal isOpen={isOpen} onClose={onClose} />;
  }

  return <SettingsModal isOpen={isOpen} onClose={onClose} />;
}

export default SettingsModal;
