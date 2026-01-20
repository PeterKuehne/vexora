import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AppShell,
  ChatContainer,
  MainSidebar,
  Header,
  OllamaConnectionError,
  SaveIndicator,
  SettingsModal,
  StorageQuotaAlert,
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
  DocumentProvider,
  useToast,
  useToasts,
} from './contexts';

function AppContent() {
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('qwen3:8b');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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

  // Settings modal handlers
  const handleSettingsClick = () => {
    setIsSettingsModalOpen(true);
  };

  const handleSettingsModalClose = () => {
    setIsSettingsModalOpen(false);
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
    <MainSidebar
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
    <ChatProvider key={activeConversation.id} initialModel={selectedModel} selectedModel={selectedModel}>
      <div className="flex flex-col h-full">
        {/* Storage Quota Alert - Show when approaching limits */}
        <div className="shrink-0 p-4">
          <StorageQuotaAlert />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 overflow-hidden">
          <ChatContainer />
        </div>
      </div>
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleSettingsModalClose}
      />
    </>
  );
}

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider>
          <ConversationProvider>
            <DocumentProvider>
              <AppContent />
            </DocumentProvider>
          </ConversationProvider>
        </ToastProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
