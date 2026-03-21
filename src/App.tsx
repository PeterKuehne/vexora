import { useEffect, useState, useRef, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  ChatContainer,
  OllamaConnectionError,
  SettingsModal,
  StorageQuotaAlert,
  ToastContainer,
  ProtectedRoute,
  ErrorBoundary,
  ConversationSidebar,
  WorkspaceLayout,
  type WorkspaceSection,
} from './components';
import { AgentTaskSidebar } from './components/AgentTaskSidebar';
import { AgentTaskDetail } from './components/AgentTaskDetail';
import { ModelSelector } from './components/ModelSelector';
import { LoginPage, AdminUsersPage, AdminSystemSettingsPage, AuditLogsPage, DocumentsPage, DocumentsPageEmbedded, ProfilePage } from './pages';
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
  RAGProvider,
  AuthProvider,
  useAuth,
  useToast,
  useToasts,
} from './contexts';
import { AgentProvider, useAgent } from './contexts/AgentContext';

function ChatApp() {
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('qwen3:8b');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Auth Context
  const { user, isLoading: isAuthLoading, logout } = useAuth();

  // Ref to store the checkConnectivity function for use in handleRetry
  const checkConnectivityRef = useRef<(() => Promise<boolean>) | null>(null);

  const {
    activeConversation,
    createConversation,
    isLoading: isLoadingConversations,
  } = useConversations();

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

    checkConnectivityRef.current = checkConnectivity;
    checkConnectivity();

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

  const { isDark } = useTheme();

  // Render main content based on active workspace section
  const renderContent = (activeSection: WorkspaceSection) => {
    if (activeSection === 'documents') {
      return <DocumentsPageEmbedded />;
    }

    if (activeSection === 'tasks') {
      return <AgentTaskDetail />;
    }

    // Chat section (default)
    return (
      <div className="flex flex-col h-full">
        {/* Slim header: ModelSelector + Connection Status */}
        <div className={`
          shrink-0 flex items-center justify-between
          px-4 py-2 border-b
          ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}
        `}>
          {/* Left: Active conversation title */}
          <div className={`text-sm font-medium truncate ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            {activeConversation?.title || 'Neue Unterhaltung'}
          </div>

          {/* Right: Model selector + connection dot */}
          <div className="flex items-center gap-3">
            {isOllamaConnected && (
              <div className="hidden sm:block">
                <ModelSelector
                  value={selectedModel}
                  onChange={setSelectedModel}
                  disabled={!isOllamaConnected}
                />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                isOllamaConnected === null ? 'bg-yellow-500' :
                isOllamaConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                {isOllamaConnected ? `${availableModels.length} Modelle` : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          {isOllamaConnected === false ? (
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
                <div className="shrink-0 px-4 pt-2">
                  <StorageQuotaAlert />
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatContainer />
                </div>
              </div>
            </ChatProvider>
          ) : null}
        </div>
      </div>
    );
  };

  // Chat sidebar: ConversationSidebar already renders its own <Sidebar> wrapper
  // so we just pass it directly - no extra wrapper needed
  const chatSidebar = <ConversationSidebar />;
  const tasksSidebar = <AgentTaskSidebar />;

  return (
    <>
      <WorkspaceLayout
        chatSidebar={chatSidebar}
        tasksSidebar={tasksSidebar}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        userName={user?.name || user?.email}
        onLogout={logout}
      >
        {renderContent}
      </WorkspaceLayout>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/chat"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <ConversationProvider>
                <DocumentProvider>
                  <RAGProvider>
                    <AgentProvider>
                      <ChatApp />
                    </AgentProvider>
                  </RAGProvider>
                </DocumentProvider>
              </ConversationProvider>
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/documents"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <DocumentProvider>
                <DocumentsPage />
              </DocumentProvider>
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="Admin">
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute requiredRole="Admin">
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute requiredRole="Admin">
            <AdminSystemSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
