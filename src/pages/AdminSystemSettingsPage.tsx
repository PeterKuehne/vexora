/**
 * Admin System Settings Page
 * Allows administrators to configure system-wide settings
 * Follows MANDATORY TailwindCSS styling convention with theme support
 */

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchSystemSettings,
  updateSystemSettings,
  resetSystemSettings,
  type SystemSettings
} from '../lib/api';
import {
  Settings,
  Clock,
  Search,
  HardDrive,
  Shield,
  Zap,
  Save,
  RotateCcw,
  AlertTriangle,
  Info
} from 'lucide-react';

export function AdminSystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [editedSettings, setEditedSettings] = useState<Partial<SystemSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('tokenSettings');

  const { theme } = useTheme();
  const { addToast } = useToast();
  const isDark = theme === 'dark';

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(Object.keys(editedSettings).length > 0);
  }, [editedSettings]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetchSystemSettings();
      setSettings(response.data.settings);
      setEditedSettings({});
    } catch (error) {
      console.error('Error loading settings:', error);
      addToast('error', 'Fehler beim Laden der Systemeinstellungen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (section: keyof SystemSettings, key: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleSaveSettings = async () => {
    if (!settings || Object.keys(editedSettings).length === 0) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await updateSystemSettings(editedSettings);
      setSettings(response.data.settings);
      setEditedSettings({});
      addToast('success', `Einstellungen erfolgreich gespeichert (${response.data.applied.length} Änderungen)`);
    } catch (error) {
      console.error('Error updating settings:', error);
      addToast('error', 'Fehler beim Speichern der Einstellungen');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    try {
      setIsSaving(true);
      const response = await resetSystemSettings();
      setSettings(response.data.settings);
      setEditedSettings({});
      setShowResetConfirm(false);
      addToast('success', 'Einstellungen auf Standardwerte zurückgesetzt');
    } catch (error) {
      console.error('Error resetting settings:', error);
      addToast('error', 'Fehler beim Zurücksetzen der Einstellungen');
    } finally {
      setIsSaving(false);
    }
  };

  const getCurrentValue = (section: keyof SystemSettings, key: string): any => {
    const editedSection = editedSettings[section] as any;
    const originalSection = settings?.[section] as any;
    return editedSection?.[key] ?? originalSection?.[key];
  };

  // Settings sections configuration
  const settingSections = [
    {
      id: 'tokenSettings',
      name: 'Token-Konfiguration',
      icon: Clock,
      description: 'JWT Token Lifetime und Sicherheitseinstellungen',
      color: 'blue'
    },
    {
      id: 'ragSettings',
      name: 'RAG-Parameter',
      icon: Search,
      description: 'Retrieval-Augmented Generation Suchparameter',
      color: 'green'
    },
    {
      id: 'storageSettings',
      name: 'Speicher-Quoten',
      icon: HardDrive,
      description: 'Benutzer-Speicherlimits und Quota-Management',
      color: 'orange'
    },
    {
      id: 'oauthSettings',
      name: 'OAuth2-Provider',
      icon: Shield,
      description: 'Authentication Provider und Session-Konfiguration',
      color: 'purple'
    },
    {
      id: 'performanceSettings',
      name: 'Performance',
      icon: Zap,
      description: 'System-Performance und Concurrent Processing',
      color: 'red'
    }
  ];

  if (isLoading) {
    return (
      <div className={`
        min-h-screen flex items-center justify-center
        transition-colors duration-150
        ${isDark ? 'bg-background' : 'bg-white'}
      `}>
        <div className={`
          flex items-center space-x-3
          px-6 py-4 rounded-lg
          transition-colors duration-150
          ${isDark
            ? 'text-gray-300 bg-surface/50'
            : 'text-gray-600 bg-white/50'
          }
        `}>
          <div className={`
            w-5 h-5 border-2 border-t-transparent rounded-full animate-spin
            transition-colors duration-150
            ${isDark ? 'border-gray-400' : 'border-gray-500'}
          `} />
          <span className="text-sm font-medium">Lade Systemeinstellungen...</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={`
        min-h-screen flex items-center justify-center
        transition-colors duration-150
        ${isDark ? 'bg-background' : 'bg-white'}
      `}>
        <div className={`
          text-center p-8 rounded-lg border
          transition-colors duration-150
          ${isDark
            ? 'bg-surface border-white/10 text-gray-300'
            : 'bg-white border-gray-200 text-gray-600'
          }
        `}>
          <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-lg font-semibold mb-2">Fehler beim Laden</h2>
          <p className="text-sm">Die Systemeinstellungen konnten nicht geladen werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      min-h-screen
      transition-colors duration-150
      ${isDark ? 'bg-background' : 'bg-white'}
    `}>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`
                text-3xl font-bold flex items-center gap-3
                transition-colors duration-150
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                <Settings className="text-blue-500" size={32} />
                System-Einstellungen
              </h1>
              <p className={`
                mt-2 text-sm
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                Konfiguration systemweiter Parameter und Sicherheitseinstellungen
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <div className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg
                  transition-colors duration-150
                  ${isDark
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-orange-50 text-orange-700 border border-orange-200'
                  }
                `}>
                  <Info size={16} />
                  <span className="text-sm font-medium">Ungespeicherte Änderungen</span>
                </div>
              )}

              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={isSaving}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg
                  text-sm font-medium border
                  transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-gray-500
                  ${isSaving
                    ? 'opacity-50 cursor-not-allowed'
                    : isDark
                      ? 'border-white/20 text-gray-300 hover:border-white/30 hover:text-white hover:bg-white/5'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:bg-black/5'
                  }
                `}
              >
                <RotateCcw size={16} />
                Zurücksetzen
              </button>

              <button
                onClick={handleSaveSettings}
                disabled={!hasUnsavedChanges || isSaving}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg
                  text-sm font-medium
                  transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${hasUnsavedChanges && !isSaving
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                  }
                `}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Settings Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {settingSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const hasChanges = editedSettings[section.id as keyof SystemSettings];

                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      w-full text-left p-4 rounded-lg border
                      transition-all duration-150
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${isActive
                        ? isDark
                          ? `bg-${section.color}-500/20 border-${section.color}-500/30 text-${section.color}-400`
                          : `bg-${section.color}-50 border-${section.color}-200 text-${section.color}-700`
                        : isDark
                          ? 'bg-surface border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/5'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon size={18} />
                        <span className="font-medium">{section.name}</span>
                      </div>
                      {hasChanges && (
                        <div className={`
                          w-2 h-2 rounded-full
                          ${isDark ? 'bg-orange-400' : 'bg-orange-500'}
                        `} />
                      )}
                    </div>
                    <p className={`
                      text-xs opacity-75
                      ${isActive && !isDark ? 'opacity-60' : ''}
                    `}>
                      {section.description}
                    </p>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <div className={`
              p-6 rounded-lg border
              transition-colors duration-150
              ${isDark
                ? 'bg-surface border-white/10'
                : 'bg-white border-gray-200'
              }
            `}>

              {/* Token Settings */}
              {activeSection === 'tokenSettings' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Clock className="text-blue-500" size={24} />
                    <h2 className={`
                      text-xl font-semibold
                      transition-colors duration-150
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      JWT Token Konfiguration
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Access Token Lifetime */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Access Token Lifetime (Minuten)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={getCurrentValue('tokenSettings', 'accessTokenLifetime')}
                        onChange={(e) => handleSettingChange('tokenSettings', 'accessTokenLifetime', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-blue-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Empfohlen: 15 Minuten für bessere Sicherheit
                      </p>
                    </div>

                    {/* Refresh Token Lifetime */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Refresh Token Lifetime (Tage)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={getCurrentValue('tokenSettings', 'refreshTokenLifetime')}
                        onChange={(e) => handleSettingChange('tokenSettings', 'refreshTokenLifetime', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-blue-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Empfohlen: 7 Tage für Balance zwischen Sicherheit und UX
                      </p>
                    </div>

                    {/* Token Rotation */}
                    <div className="md:col-span-2">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={getCurrentValue('tokenSettings', 'enableTokenRotation')}
                          onChange={(e) => handleSettingChange('tokenSettings', 'enableTokenRotation', e.target.checked)}
                          className="rounded focus:ring-blue-500"
                        />
                        <span className={`
                          text-sm font-medium
                          transition-colors duration-150
                          ${isDark ? 'text-gray-300' : 'text-gray-700'}
                        `}>
                          Token Rotation aktivieren
                        </span>
                      </label>
                      <p className={`
                        text-xs mt-1 ml-6
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Refresh Tokens werden bei jeder Verwendung rotiert (empfohlen für höchste Sicherheit)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* RAG Settings */}
              {activeSection === 'ragSettings' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Search className="text-green-500" size={24} />
                    <h2 className={`
                      text-xl font-semibold
                      transition-colors duration-150
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      RAG Suchparameter
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Default Search Limit */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Standard Suchlimit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={getCurrentValue('ragSettings', 'defaultSearchLimit')}
                        onChange={(e) => handleSettingChange('ragSettings', 'defaultSearchLimit', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-green-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Anzahl der Dokumente die standardmäßig durchsucht werden
                      </p>
                    </div>

                    {/* Max Search Limit */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Maximum Suchlimit
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={getCurrentValue('ragSettings', 'maxSearchLimit')}
                        onChange={(e) => handleSettingChange('ragSettings', 'maxSearchLimit', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-green-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Maximale Anzahl Dokumente die User anfordern können
                      </p>
                    </div>

                    {/* Similarity Threshold */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Ähnlichkeits-Schwellwert ({getCurrentValue('ragSettings', 'defaultSimilarityThreshold').toFixed(2)})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={getCurrentValue('ragSettings', 'defaultSimilarityThreshold')}
                        onChange={(e) => handleSettingChange('ragSettings', 'defaultSimilarityThreshold', parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Mindest-Ähnlichkeit für Dokument-Relevanz (0.0 = alle, 1.0 = nur exakte Treffer)
                      </p>
                    </div>

                    {/* Hybrid Alpha */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Hybrid Search Balance ({getCurrentValue('ragSettings', 'defaultHybridAlpha').toFixed(2)})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={getCurrentValue('ragSettings', 'defaultHybridAlpha')}
                        onChange={(e) => handleSettingChange('ragSettings', 'defaultHybridAlpha', parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className={`
                        flex justify-between text-xs mt-1
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        <span>Keyword-Suche</span>
                        <span>Semantische Suche</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Storage Settings */}
              {activeSection === 'storageSettings' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <HardDrive className="text-orange-500" size={24} />
                    <h2 className={`
                      text-xl font-semibold
                      transition-colors duration-150
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      Speicher-Quota Management
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Default User Quota */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Standard Benutzer-Quota (MB)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="10000"
                        step="10"
                        value={getCurrentValue('storageSettings', 'defaultUserQuotaMB')}
                        onChange={(e) => handleSettingChange('storageSettings', 'defaultUserQuotaMB', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-orange-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Speicherlimit für neue Benutzer ({Math.round(getCurrentValue('storageSettings', 'defaultUserQuotaMB') / 1024 * 100) / 100} GB)
                      </p>
                    </div>

                    {/* Max User Quota */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Maximum Benutzer-Quota (MB)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="50000"
                        step="50"
                        value={getCurrentValue('storageSettings', 'maxUserQuotaMB')}
                        onChange={(e) => handleSettingChange('storageSettings', 'maxUserQuotaMB', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-orange-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Absolutes Maximum pro Benutzer ({Math.round(getCurrentValue('storageSettings', 'maxUserQuotaMB') / 1024 * 100) / 100} GB)
                      </p>
                    </div>

                    {/* Quota Enforcement */}
                    <div className="md:col-span-2">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={getCurrentValue('storageSettings', 'enableQuotaEnforcement')}
                          onChange={(e) => handleSettingChange('storageSettings', 'enableQuotaEnforcement', e.target.checked)}
                          className="rounded focus:ring-orange-500"
                        />
                        <span className={`
                          text-sm font-medium
                          transition-colors duration-150
                          ${isDark ? 'text-gray-300' : 'text-gray-700'}
                        `}>
                          Quota-Durchsetzung aktivieren
                        </span>
                      </label>
                      <p className={`
                        text-xs mt-1 ml-6
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Blockiert Uploads wenn Benutzer ihre Quota erreicht haben
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* OAuth Settings */}
              {activeSection === 'oauthSettings' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="text-purple-500" size={24} />
                    <h2 className={`
                      text-xl font-semibold
                      transition-colors duration-150
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      OAuth2 Provider Konfiguration
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Microsoft OAuth */}
                    <div>
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={getCurrentValue('oauthSettings', 'enableMicrosoftOAuth')}
                          onChange={(e) => handleSettingChange('oauthSettings', 'enableMicrosoftOAuth', e.target.checked)}
                          className="rounded focus:ring-purple-500"
                        />
                        <span className={`
                          text-sm font-medium
                          transition-colors duration-150
                          ${isDark ? 'text-gray-300' : 'text-gray-700'}
                        `}>
                          Microsoft OAuth2 aktivieren
                        </span>
                      </label>
                      <p className={`
                        text-xs mt-1 ml-6
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Ermöglicht Anmeldung mit Microsoft Konten
                      </p>
                    </div>

                    {/* Google OAuth */}
                    <div>
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={getCurrentValue('oauthSettings', 'enableGoogleOAuth')}
                          onChange={(e) => handleSettingChange('oauthSettings', 'enableGoogleOAuth', e.target.checked)}
                          className="rounded focus:ring-purple-500"
                        />
                        <span className={`
                          text-sm font-medium
                          transition-colors duration-150
                          ${isDark ? 'text-gray-300' : 'text-gray-700'}
                        `}>
                          Google OAuth2 aktivieren
                        </span>
                      </label>
                      <p className={`
                        text-xs mt-1 ml-6
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Ermöglicht Anmeldung mit Google Konten
                      </p>
                    </div>

                    {/* Session Timeout */}
                    <div className="md:col-span-2 space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Session Timeout (Stunden)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="72"
                        value={getCurrentValue('oauthSettings', 'sessionTimeoutHours')}
                        onChange={(e) => handleSettingChange('oauthSettings', 'sessionTimeoutHours', parseInt(e.target.value))}
                        className={`
                          w-full md:w-1/3 px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-purple-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Automatische Abmeldung nach Inaktivität
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Settings */}
              {activeSection === 'performanceSettings' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Zap className="text-red-500" size={24} />
                    <h2 className={`
                      text-xl font-semibold
                      transition-colors duration-150
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      System Performance
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Max Concurrent Jobs */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Max. gleichzeitige Jobs
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={getCurrentValue('performanceSettings', 'maxConcurrentJobs')}
                        onChange={(e) => handleSettingChange('performanceSettings', 'maxConcurrentJobs', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-red-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Anzahl parallel verarbeitbarer Dokumente
                      </p>
                    </div>

                    {/* Request Timeout */}
                    <div className="space-y-2">
                      <label className={`
                        block text-sm font-medium
                        transition-colors duration-150
                        ${isDark ? 'text-gray-300' : 'text-gray-700'}
                      `}>
                        Request Timeout (Sekunden)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="300"
                        step="10"
                        value={getCurrentValue('performanceSettings', 'requestTimeoutSeconds')}
                        onChange={(e) => handleSettingChange('performanceSettings', 'requestTimeoutSeconds', parseInt(e.target.value))}
                        className={`
                          w-full px-3 py-2 rounded-lg border
                          transition-colors duration-150
                          focus:outline-none focus:ring-2 focus:ring-red-500
                          ${isDark
                            ? 'bg-surface-secondary border-white/20 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }
                        `}
                      />
                      <p className={`
                        text-xs
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Timeout für API Anfragen
                      </p>
                    </div>

                    {/* Request Logging */}
                    <div className="md:col-span-2">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={getCurrentValue('performanceSettings', 'enableRequestLogging')}
                          onChange={(e) => handleSettingChange('performanceSettings', 'enableRequestLogging', e.target.checked)}
                          className="rounded focus:ring-red-500"
                        />
                        <span className={`
                          text-sm font-medium
                          transition-colors duration-150
                          ${isDark ? 'text-gray-300' : 'text-gray-700'}
                        `}>
                          Request Logging aktivieren
                        </span>
                      </label>
                      <p className={`
                        text-xs mt-1 ml-6
                        transition-colors duration-150
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Detailliertes Logging aller API-Requests (kann Performance beeinträchtigen)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className={`
              fixed inset-0
              ${isDark ? 'bg-black/50' : 'bg-gray-900/50'}
            `} onClick={() => setShowResetConfirm(false)} />

            <div className={`
              relative bg-white dark:bg-surface rounded-lg p-6 max-w-md mx-4
              border shadow-xl
              transition-colors duration-150
              ${isDark ? 'border-white/10' : 'border-gray-200'}
            `}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-red-500" size={24} />
                <h3 className={`
                  text-lg font-semibold
                  transition-colors duration-150
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}>
                  Einstellungen zurücksetzen?
                </h3>
              </div>

              <p className={`
                text-sm mb-6
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                Alle Systemeinstellungen werden auf die Standardwerte zurückgesetzt.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className={`
                    px-4 py-2 rounded-lg border text-sm font-medium
                    transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-gray-500
                    ${isDark
                      ? 'border-white/20 text-gray-300 hover:border-white/30 hover:text-white'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900'
                    }
                  `}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleResetSettings}
                  disabled={isSaving}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-red-500
                    ${isSaving
                      ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                      : 'bg-red-600 text-white hover:bg-red-700'
                    }
                  `}
                >
                  {isSaving ? 'Zurücksetzen...' : 'Zurücksetzen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}