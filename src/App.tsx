import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AppShell,
  ChatContainer,
  ConversationSidebar,
  Header,
  OllamaConnectionError,
  SaveIndicator,
  ToastContainer,
  type SidebarControls,
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

function AppContent() {
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('qwen3:8b');

  // Ref to store the checkConnectivity function for use in handleRetry
  const checkConnectivityRef = useRef<(() => Promise<boolean>) | null>(null);

  const {
    activeConversation,
    createConversation,
    isLoading: isLoadingConversations,
    saveStatus,
    lastSavedAt,
  } = useConversations();

  const { theme, setTheme } = useTheme();
  const toasts = useToasts();
  const { removeToast } = useToast();

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

  // Placeholder for settings modal - will be implemented in a future feature
  const handleSettingsClick = () => {
    // TODO: Open settings modal when implemented
    console.log('Settings button clicked - modal coming soon!');
  };

  // Render header with sidebar controls from AppShell
  const renderHeader = (sidebarControls: SidebarControls) => (
    <Header
      onNewConversation={handleNewConversation}
      theme={theme}
      onThemeChange={setTheme}
      isOllamaConnected={isOllamaConnected}
      modelCount={availableModels.length}
      saveIndicator={<SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />}
      showMobileMenu={true}
      onToggleSidebar={sidebarControls.toggle}
      isSidebarCollapsed={sidebarControls.isCollapsed}
      hasSidebar={sidebarControls.hasSidebar}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      showModelSelector={true}
      onSettingsClick={handleSettingsClick}
      showSettingsButton={true}
    />
  );

  // Sidebar Content - receives controls from AppShell
  const renderSidebar = (sidebarControls: SidebarControls) => (
    <ConversationSidebar
      isCollapsed={sidebarControls.isCollapsed}
      onToggleCollapse={sidebarControls.toggle}
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
    <ChatProvider key={activeConversation.id} initialModel={selectedModel}>
      <ChatContainer />
    </ChatProvider>
  ) : null;

  return (
    <>
      <AppShell
        header={renderHeader}
        sidebar={renderSidebar}
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
