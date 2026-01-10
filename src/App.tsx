import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Sun, Moon, Monitor } from 'lucide-react';
import {
  AppShell,
  ChatContainer,
  ConversationSidebar,
  OllamaConnectionError,
  SaveIndicator,
  ToastContainer,
} from './components';
import { checkHealth } from './lib/api';
import {
  ConversationProvider,
  useConversations,
  ThemeProvider,
  useTheme,
  SettingsProvider,
  ChatProvider,
  ToastProvider,
  useToast,
  useToasts,
} from './contexts';
import type { Theme } from './types/settings';

function AppContent() {
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

  // Ref to store the checkConnectivity function for use in handleRetry
  const checkConnectivityRef = useRef<(() => Promise<boolean>) | null>(null);

  const {
    activeConversation,
    createConversation,
    isLoading: isLoadingConversations,
    saveStatus,
    lastSavedAt,
  } = useConversations();

  const { theme, setTheme, isDark } = useTheme();
  const toasts = useToasts();
  const { removeToast } = useToast();

  // Cycle through themes: dark -> light -> system -> dark
  const cycleTheme = () => {
    const themeOrder: Theme[] = ['dark', 'light', 'system'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  };

  // Get theme icon and label
  const getThemeInfo = () => {
    switch (theme) {
      case 'light':
        return { icon: Sun, label: 'Hell' };
      case 'system':
        return { icon: Monitor, label: 'System' };
      case 'dark':
      default:
        return { icon: Moon, label: 'Dunkel' };
    }
  };

  const themeInfo = getThemeInfo();

  // Check backend and Ollama connectivity on mount
  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const health = await checkHealth();
        setIsOllamaConnected(health.services.ollama.status === 'ok');
        setAvailableModels(health.services.ollama.available_models || []);
        return health.services.ollama.status === 'ok';
      } catch {
        setIsOllamaConnected(false);
        return false;
      }
    };

    // Store in ref for retry button
    checkConnectivityRef.current = checkConnectivity;

    checkConnectivity();

    // Check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle retry button click
  const handleRetry = useCallback(async () => {
    if (!checkConnectivityRef.current) return;
    setIsRetrying(true);
    await checkConnectivityRef.current();
    setIsRetrying(false);
  }, []);

  // Auto-create first conversation if none exists
  useEffect(() => {
    if (!isLoadingConversations && !activeConversation) {
      createConversation();
    }
  }, [isLoadingConversations, activeConversation, createConversation]);

  const handleNewConversation = () => {
    createConversation();
  };

  // Connection status indicator
  const connectionStatusColor = isOllamaConnected === null
    ? 'bg-yellow-500'
    : isOllamaConnected
      ? 'bg-green-500'
      : 'bg-red-500';

  const connectionStatusText = isOllamaConnected === null
    ? 'Verbinde...'
    : isOllamaConnected
      ? `Ollama (${availableModels.length} Modelle)`
      : 'Ollama nicht verbunden';

  // Header Left Content
  const headerLeft = (
    <>
      <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Qwen Chat
      </h1>

      {/* New Conversation Button */}
      <button
        onClick={handleNewConversation}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
          isDark
            ? 'text-gray-300 hover:text-white hover:bg-white/10'
            : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
        }`}
        title="Neue Unterhaltung"
      >
        <Plus size={16} />
        <span className="hidden sm:inline">Neu</span>
      </button>
    </>
  );

  // Header Right Content
  const headerContent = (
    <>
      {/* Save Indicator */}
      <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />

      {/* Theme Toggle */}
      <button
        onClick={cycleTheme}
        className={`flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-lg transition-colors ${
          isDark
            ? 'text-gray-400 hover:text-white hover:bg-white/10'
            : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
        }`}
        title={`Theme: ${themeInfo.label}`}
      >
        <themeInfo.icon size={16} />
        <span className="hidden sm:inline">{themeInfo.label}</span>
      </button>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${connectionStatusColor}`} />
        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          {connectionStatusText}
        </span>
      </div>
    </>
  );

  // Sidebar Content
  const sidebar = (
    <ConversationSidebar
      isCollapsed={false}
      onToggleCollapse={() => {}}
    />
  );

  // Main Content
  const mainContent = isOllamaConnected === false ? (
    <OllamaConnectionError
      onRetry={handleRetry}
      isRetrying={isRetrying}
    />
  ) : isLoadingConversations ? (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400">Lade Unterhaltungen...</div>
    </div>
  ) : activeConversation ? (
    <ChatProvider key={activeConversation.id}>
      <ChatContainer />
    </ChatProvider>
  ) : null;

  return (
    <>
      <AppShell
        headerLeft={headerLeft}
        headerContent={headerContent}
        sidebar={sidebar}
        showMobileMenu={true}
      >
        {mainContent}
      </AppShell>

      {/* Toast Notifications - Outside AppShell for proper z-index */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </>
  );
}

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider>
          <ConversationProvider>
            <AppContent />
          </ConversationProvider>
        </ToastProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
