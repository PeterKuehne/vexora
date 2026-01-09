/**
 * OllamaConnectionError - Error display when Ollama is not running
 * Shows setup instructions and retry functionality
 */

import { useState } from 'react';
import { RefreshCw, Terminal, AlertCircle, Download, ExternalLink } from 'lucide-react';

interface OllamaConnectionErrorProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function OllamaConnectionError({
  onRetry,
  isRetrying = false,
}: OllamaConnectionErrorProps) {
  const [showFullInstructions, setShowFullInstructions] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fadeIn">
      {/* Error Icon */}
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <AlertCircle size={40} className="text-red-500" />
      </div>

      {/* Error Title */}
      <h2 className="text-2xl font-semibold text-white mb-3">
        Ollama nicht erreichbar
      </h2>

      {/* Error Description */}
      <p className="text-gray-400 max-w-lg mb-6">
        Qwen Chat benötigt Ollama, um mit lokalen KI-Modellen zu kommunizieren.
        Stelle sicher, dass Ollama installiert ist und läuft.
      </p>

      {/* Retry Button */}
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-8"
      >
        <RefreshCw
          size={18}
          className={isRetrying ? 'animate-spin' : ''}
        />
        {isRetrying ? 'Verbindung wird geprüft...' : 'Erneut versuchen'}
      </button>

      {/* Quick Start Command */}
      <div className="w-full max-w-md bg-surface/50 rounded-xl border border-white/10 p-6 mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
          <Terminal size={16} />
          Schnellstart
        </h3>
        <div className="bg-black/30 rounded-lg p-4">
          <code className="text-green-400 font-mono text-sm">
            ollama serve
          </code>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Führe diesen Befehl in einem Terminal aus, um Ollama zu starten.
        </p>
      </div>

      {/* Expand/Collapse Instructions */}
      <button
        onClick={() => setShowFullInstructions(!showFullInstructions)}
        className="text-sm text-primary hover:text-primary/80 transition-colors mb-4"
      >
        {showFullInstructions ? 'Weniger anzeigen' : 'Vollständige Anleitung anzeigen'}
      </button>

      {/* Full Setup Instructions */}
      {showFullInstructions && (
        <div className="w-full max-w-lg bg-surface/30 rounded-xl border border-white/5 p-6 text-left animate-fadeIn">
          <h3 className="text-lg font-medium text-white mb-4">
            Ollama Setup-Anleitung
          </h3>

          {/* Step 1: Install */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-300 font-medium mb-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm">
                1
              </span>
              <Download size={16} className="text-gray-400" />
              Ollama installieren
            </div>
            <p className="text-sm text-gray-400 ml-8 mb-2">
              Besuche die offizielle Website und lade Ollama herunter:
            </p>
            <a
              href="https://ollama.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ml-8 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              https://ollama.ai
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Step 2: Pull Model */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-300 font-medium mb-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm">
                2
              </span>
              <Terminal size={16} className="text-gray-400" />
              Modell herunterladen
            </div>
            <p className="text-sm text-gray-400 ml-8 mb-2">
              Lade das Qwen3:8B Modell (empfohlen) herunter:
            </p>
            <div className="ml-8 bg-black/30 rounded-lg p-3 font-mono text-sm text-green-400">
              ollama pull qwen3:8b
            </div>
          </div>

          {/* Step 3: Start Server */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-gray-300 font-medium mb-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm">
                3
              </span>
              <RefreshCw size={16} className="text-gray-400" />
              Server starten
            </div>
            <p className="text-sm text-gray-400 ml-8 mb-2">
              Starte den Ollama-Server:
            </p>
            <div className="ml-8 bg-black/30 rounded-lg p-3 font-mono text-sm text-green-400">
              ollama serve
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Häufige Probleme
            </h4>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Port 11434 bereits belegt? Schließe andere Ollama-Instanzen.</li>
              <li>• Firewall blockiert? Erlaube Ollama in den Einstellungen.</li>
              <li>• macOS: Prüfe ob Ollama in der Menüleiste läuft.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Connection Info */}
      <div className="mt-6 text-xs text-gray-600">
        Verbindungsadresse: <code className="text-gray-500">http://localhost:11434</code>
      </div>
    </div>
  );
}

export default OllamaConnectionError;
