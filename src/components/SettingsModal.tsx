/**
 * SettingsModal Component
 * Modal dialog for application settings using Headless UI
 * Features tab navigation, form controls, and responsive design
 */

import { Fragment, useState } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { X, Settings, Palette, Keyboard, Sliders } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings, useFontSize } from '../contexts/SettingsContext';
import { GeneralSettings } from './GeneralSettings';
import { ModelSettings } from './ModelSettings';
import { AdvancedSettings } from './AdvancedSettings';
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
];

/**
 * Settings Modal with tabbed interface
 */
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isDark } = useTheme();
  const { settings, updateSetting, resetSettings } = useSettings();
  const { fontSize, setFontSize, fontSizeClass } = useFontSize();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const handleThemeChange = (newTheme: Theme) => {
    updateSetting('theme', newTheme);
  };

  const handleFontSizeChange = (newSize: FontSize) => {
    setFontSize(newSize);
  };

  const handleReset = () => {
    if (confirm('Möchtest du alle Einstellungen auf die Standardwerte zurücksetzen?')) {
      resetSettings();
    }
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
              fixed inset-0
              ${isDark ? 'bg-black/50' : 'bg-gray-900/50'}
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
                  rounded-lg shadow-2xl
                  transform overflow-hidden
                  transition-all
                  ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
                `}
              >
                {/* Header */}
                <div
                  className={`
                    flex items-center justify-between
                    px-6 py-4
                    border-b
                    ${isDark ? 'border-gray-700' : 'border-gray-200'}
                  `}
                >
                  <Dialog.Title as="h2" className="text-xl font-semibold">
                    Einstellungen
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className={`
                      p-2 rounded-lg
                      transition-colors
                      ${
                        isDark
                          ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }
                    `}
                    title="Schließen"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Tab Navigation */}
                <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
                  <div className="flex">
                    {/* Tab List - Sidebar */}
                    <div
                      className={`
                        w-64 shrink-0
                        border-r
                        ${isDark ? 'border-gray-700' : 'border-gray-200'}
                      `}
                    >
                      <Tab.List className="flex flex-col p-2">
                        {SETTINGS_TABS.map((tab) => (
                          <Tab key={tab.id} as={Fragment}>
                            {({ selected }) => (
                              <button
                                className={`
                                  w-full flex items-center gap-3
                                  px-3 py-3 text-left
                                  rounded-lg transition-all
                                  ${
                                    selected
                                      ? isDark
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-100 text-blue-900'
                                      : isDark
                                        ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                                  }
                                `}
                              >
                                <tab.icon size={18} />
                                <div>
                                  <div className="font-medium">{tab.name}</div>
                                  <div
                                    className={`
                                      text-xs opacity-75
                                      ${selected && !isDark ? 'opacity-60' : ''}
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
                    <div className="flex-1 p-6">
                      <Tab.Panels className="focus:outline-none">
                        {/* General Settings */}
                        <Tab.Panel className="focus:outline-none">
                          <GeneralSettings />
                        </Tab.Panel>

                        {/* Appearance Settings */}
                        <Tab.Panel className="space-y-6 focus:outline-none">
                          <div>
                            <h3 className="text-lg font-medium mb-4">Darstellung</h3>

                            {/* Theme */}
                            <div className="space-y-2">
                              <label className="block text-sm font-medium">Design</label>
                              <div className="flex gap-2">
                                {(['light', 'dark', 'system'] as Theme[]).map((theme) => (
                                  <button
                                    key={theme}
                                    onClick={() => handleThemeChange(theme)}
                                    className={`
                                      px-4 py-2 rounded-lg
                                      border transition-all
                                      ${
                                        settings.theme === theme
                                          ? 'border-blue-500 bg-blue-100 text-blue-900'
                                          : isDark
                                            ? 'border-gray-600 text-gray-300 hover:border-gray-500'
                                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                                      }
                                    `}
                                  >
                                    {theme === 'light' ? 'Hell' : theme === 'dark' ? 'Dunkel' : 'System'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Font Size */}
                            <div className="space-y-2">
                              <label className="block text-sm font-medium">Schriftgröße</label>
                              <div className="flex gap-2">
                                {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                                  <button
                                    key={size}
                                    onClick={() => handleFontSizeChange(size)}
                                    className={`
                                      px-4 py-2 rounded-lg
                                      border transition-all
                                      ${
                                        fontSize === size
                                          ? 'border-blue-500 bg-blue-100 text-blue-900'
                                          : isDark
                                            ? 'border-gray-600 text-gray-300 hover:border-gray-500'
                                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                                      }
                                    `}
                                  >
                                    {size === 'small' ? 'Klein' : size === 'medium' ? 'Mittel' : 'Groß'}
                                  </button>
                                ))}
                              </div>
                              <div className={`text-sm ${fontSizeClass}`}>
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
                      </Tab.Panels>
                    </div>
                  </div>
                </Tab.Group>

                {/* Footer */}
                <div
                  className={`
                    flex items-center justify-between
                    px-6 py-4
                    border-t
                    ${isDark ? 'border-gray-700' : 'border-gray-200'}
                  `}
                >
                  <button
                    onClick={handleReset}
                    className={`
                      px-4 py-2 rounded-lg
                      text-sm font-medium
                      border transition-colors
                      ${
                        isDark
                          ? 'border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900'
                      }
                    `}
                  >
                    Zurücksetzen
                  </button>

                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                  >
                    Schließen
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
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
    // Simplified mobile version - could be implemented later
    return <SettingsModal isOpen={isOpen} onClose={onClose} />;
  }

  return <SettingsModal isOpen={isOpen} onClose={onClose} />;
}

export default SettingsModal;