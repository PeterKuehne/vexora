/**
 * RAGToggle Component
 *
 * Toggle switch for enabling/disabling RAG (Document Search) in conversations.
 * Shows visual feedback and document count when RAG is available.
 */

import { Search, FileText } from 'lucide-react';
import { useTheme } from '../contexts';
import { useDocuments } from '../contexts/DocumentContext';

export interface RAGToggleProps {
  /** Whether RAG is currently enabled */
  enabled: boolean;
  /** Called when toggle state changes */
  onChange: (enabled: boolean) => void;
  /** Whether RAG is available (documents exist) */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

export function RAGToggle({ enabled, onChange, disabled = false, className = '' }: RAGToggleProps) {
  const { isDark } = useTheme();
  const { documents } = useDocuments();

  const handleToggle = () => {
    if (!disabled) {
      onChange(!enabled);
    }
  };

  // Check if documents are available
  const hasDocuments = documents && documents.length > 0;
  const isDisabled = disabled || !hasDocuments;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Document Count Info */}
      <div className="flex items-center gap-1.5 text-sm">
        <FileText
          size={14}
          className={`${
            hasDocuments
              ? isDark ? 'text-blue-400' : 'text-blue-600'
              : isDark ? 'text-gray-500' : 'text-gray-400'
          }`}
        />
        <span className={`${
          hasDocuments
            ? isDark ? 'text-gray-300' : 'text-gray-700'
            : isDark ? 'text-gray-500' : 'text-gray-400'
        }`}>
          {hasDocuments ? `${documents.length} Dokument${documents.length !== 1 ? 'e' : ''}` : 'Keine Dokumente'}
        </span>
      </div>

      {/* Toggle Switch */}
      <button
        onClick={handleToggle}
        disabled={isDisabled}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
          ${enabled && !isDisabled
            ? 'bg-blue-500 focus-visible:ring-blue-500'
            : isDark
              ? 'bg-gray-700 focus-visible:ring-gray-500'
              : 'bg-gray-200 focus-visible:ring-gray-400'
          }
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}
        `.trim()}
        role="switch"
        aria-checked={enabled && !isDisabled}
        aria-label="RAG Document Search"
        title={
          isDisabled
            ? hasDocuments
              ? 'RAG ist deaktiviert'
              : 'Laden Sie Dokumente hoch, um RAG zu aktivieren'
            : enabled
              ? 'RAG aktiviert - Nachrichten durchsuchen Dokumente'
              : 'RAG deaktiviert - Standard Chat-Modus'
        }
      >
        {/* Toggle Knob */}
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0
            transition duration-200 ease-in-out
            ${enabled && !isDisabled
              ? 'translate-x-5 bg-white'
              : 'translate-x-0 bg-white'
            }
          `.trim()}
        />
      </button>

      {/* RAG Label */}
      <div className="flex items-center gap-1.5">
        <Search
          size={14}
          className={`${
            enabled && !isDisabled
              ? isDark ? 'text-blue-400' : 'text-blue-600'
              : isDark ? 'text-gray-500' : 'text-gray-400'
          }`}
        />
        <span className={`text-sm font-medium ${
          enabled && !isDisabled
            ? isDark ? 'text-blue-400' : 'text-blue-600'
            : isDark ? 'text-gray-500' : 'text-gray-400'
        }`}>
          RAG
        </span>
        {enabled && !isDisabled && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            isDark
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-blue-100 text-blue-700'
          }`}>
            AN
          </span>
        )}
      </div>
    </div>
  );
}