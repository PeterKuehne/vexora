/**
 * RAGSidebar - RAG Mode selection in sidebar
 *
 * Features:
 * - Vertical layout optimized for sidebar
 * - RAG mode selection (Manual, Intelligent, Always)
 * - Integration with RAGContext
 * - Theme-aware styling
 */

import { useRAG } from '../contexts/RAGContext';
import { useTheme } from '../contexts/ThemeContext';
import { Brain, Hand, Zap, Info } from 'lucide-react';
import type { RAGMode } from '../contexts/RAGContext';

interface ModeOption {
  mode: RAGMode;
  icon: typeof Brain;
  label: string;
  description: string;
  color: 'blue' | 'green' | 'purple';
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'manual',
    icon: Hand,
    label: 'Manuell',
    description: 'Sie entscheiden wann RAG aktiv ist',
    color: 'blue'
  },
  {
    mode: 'automatic',
    icon: Brain,
    label: 'Intelligent',
    description: 'KI erkennt automatisch relevante Fragen',
    color: 'green'
  },
  {
    mode: 'always',
    icon: Zap,
    label: 'Immer An',
    description: 'RAG ist bei allen Fragen aktiv',
    color: 'purple'
  }
];

interface RAGSidebarProps {
  /** Whether sidebar is collapsed (for mobile) */
  isCollapsed?: boolean;
}

export function RAGSidebar({ isCollapsed = false }: RAGSidebarProps) {
  const { ragMode, setRAGMode } = useRAG();
  const { isDark } = useTheme();

  const getColorClasses = (optionColor: 'blue' | 'green' | 'purple', isActive: boolean) => {
    const colorMap = {
      blue: {
        active: isDark ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-blue-100 border-blue-500 text-blue-700',
        inactive: isDark ? 'border-white/10 text-gray-400 hover:border-blue-500/50 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
      },
      green: {
        active: isDark ? 'bg-green-500/20 border-green-400 text-green-300' : 'bg-green-100 border-green-500 text-green-700',
        inactive: isDark ? 'border-white/10 text-gray-400 hover:border-green-500/50 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50'
      },
      purple: {
        active: isDark ? 'bg-purple-500/20 border-purple-400 text-purple-300' : 'bg-purple-100 border-purple-500 text-purple-700',
        inactive: isDark ? 'border-white/10 text-gray-400 hover:border-purple-500/50 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50'
      }
    };

    return isActive ? colorMap[optionColor].active : colorMap[optionColor].inactive;
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="mb-6">
        <h2
          className={`
            text-sm font-semibold mb-1
            ${isDark ? 'text-white' : 'text-gray-900'}
          `}
        >
          RAG-Modus
        </h2>
        <p
          className={`
            text-xs
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}
        >
          Wählen Sie, wie RAG aktiviert werden soll
        </p>
      </div>

      {/* Mode Options - Vertical Stack */}
      <div className="flex flex-col gap-3 mb-6">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = ragMode === option.mode;

          return (
            <button
              key={option.mode}
              onClick={() => setRAGMode(option.mode)}
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2
                transition-all duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                ${getColorClasses(option.color, isActive)}
                cursor-pointer hover:shadow-sm
                ${isDark ? 'focus-visible:ring-offset-surface' : 'focus-visible:ring-offset-white'}
              `.trim()}
            >
              {/* Icon */}
              <Icon size={20} className="shrink-0 mt-0.5" />

              {/* Content */}
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">
                    {option.label}
                  </span>
                  {isActive && (
                    <div
                      className={`
                        w-2 h-2 rounded-full
                        ${option.color === 'blue'
                          ? (isDark ? 'bg-blue-400' : 'bg-blue-500')
                          : option.color === 'green'
                          ? (isDark ? 'bg-green-400' : 'bg-green-500')
                          : (isDark ? 'bg-purple-400' : 'bg-purple-500')
                        }
                      `}
                    />
                  )}
                </div>
                <p
                  className={`
                    text-xs leading-relaxed
                    ${isActive
                      ? (isDark ? 'text-gray-300' : 'text-gray-700')
                      : (isDark ? 'text-gray-500' : 'text-gray-600')
                    }
                  `}
                >
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div
        className={`
          flex gap-3 p-4 rounded-lg border mt-auto
          ${isDark
            ? 'bg-blue-500/10 border-blue-500/20'
            : 'bg-blue-50 border-blue-200'
          }
        `}
      >
        <Info
          size={16}
          className={`shrink-0 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
        />
        <div>
          <p
            className={`
              text-xs leading-relaxed
              ${isDark ? 'text-blue-300' : 'text-blue-700'}
            `}
          >
            <strong>Hinweis:</strong> RAG (Retrieval Augmented Generation) durchsucht Ihre hochgeladenen Dokumente für kontextbezogene Antworten.
          </p>
        </div>
      </div>
    </div>
  );
}
