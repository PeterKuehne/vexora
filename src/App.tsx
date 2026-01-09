import { useEffect, useState } from 'react';
import { ChatContainer } from './components';
import { checkHealth } from './lib/api';

function App() {
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="text-lg font-semibold text-white">Qwen Chat</h1>

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
        ) : (
          // Show chat interface
          <ChatContainer />
        )}
      </main>
    </div>
  );
}

export default App;
