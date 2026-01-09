import { useEffect, useState } from 'react';
import { Plus, Menu } from 'lucide-react';
import { ChatContainer, ConversationSidebar } from './components';
import { checkHealth } from './lib/api';
import { ConversationProvider, useConversations } from './contexts';

function AppContent() {
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    activeConversation,
    createConversation,
    isLoading: isLoadingConversations,
  } = useConversations();

  // Check backend and Ollama connectivity on mount
  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const health = await checkHealth();
        setIsOllamaConnected(health.services.ollama.status === 'ok');
        setAvailableModels(health.services.ollama.available_models || []);
      } catch {
        setIsOllamaConnected(false);
      }
    };

    checkConnectivity();

    // Check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);
    return () => clearInterval(interval);
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

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={handleToggleSidebar}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors lg:hidden"
            title="Sidebar umschalten"
          >
            <Menu size={20} />
          </button>

          <h1 className="text-lg font-semibold text-white">Qwen Chat</h1>

          {/* New Conversation Button */}
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Neue Unterhaltung"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neu</span>
          </button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              isOllamaConnected === null
                ? 'bg-yellow-500'
                : isOllamaConnected
                  ? 'bg-green-500'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-gray-400">
            {isOllamaConnected === null
              ? 'Verbinde...'
              : isOllamaConnected
                ? `Ollama (${availableModels.length} Modelle)`
                : 'Ollama nicht verbunden'}
          </span>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - hidden on mobile when collapsed */}
        <div className={`${isSidebarCollapsed ? 'hidden' : 'flex'} lg:flex`}>
          <ConversationSidebar
            isCollapsed={false}
            onToggleCollapse={handleToggleSidebar}
          />
        </div>

        {/* Main Chat Area */}
        <main className="flex-1 overflow-hidden">
        {isOllamaConnected === false ? (
          // Ollama not connected - show error
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-medium text-white mb-2">
              Ollama nicht erreichbar
            </h2>
            <p className="text-gray-400 max-w-md mb-4">
              Stelle sicher, dass Ollama läuft und auf{' '}
              <code className="px-1 py-0.5 rounded bg-white/10 text-sm">
                localhost:11434
              </code>{' '}
              erreichbar ist.
            </p>
            <div className="text-sm text-gray-500">
              <p className="mb-1">Starte Ollama mit:</p>
              <code className="block px-3 py-2 rounded bg-white/5 text-gray-300">
                ollama serve
              </code>
            </div>
          </div>
        ) : isLoadingConversations ? (
          // Loading state
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Lade Unterhaltungen...</div>
          </div>
        ) : activeConversation ? (
          // Show chat interface with active conversation
          <ChatContainer key={activeConversation.id} />
        ) : null}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ConversationProvider>
      <AppContent />
    </ConversationProvider>
  );
}

export default App;
