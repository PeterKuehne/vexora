/**
 * RAGSidebar - RAG Mode selection in sidebar
 *
 * Features:
 * - Vertical layout optimized for sidebar
 * - RAG mode selection (Manual, Intelligent, Always)
 * - Integration with RAGContext
 * - Theme-aware styling
 * - Refined design with accent bars and glass-morphic effects
 */

import { useRAG } from '../contexts/RAGContext';
import { useTheme } from '../contexts/ThemeContext';
import { Brain, Hand, Zap, Sparkles } from 'lucide-react';
import type { RAGMode } from '../contexts/RAGContext';

interface ModeOption {
  mode: RAGMode;
  icon: typeof Brain;
  label: string;
  description: string;
  accentColor: string;
  accentColorLight: string;
  glowColor: string;
  bgActive: string;
  bgActiveLight: string;
  dotColor: string;
  dotColorLight: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'manual',
    icon: Hand,
    label: 'Manuell',
    description: 'Sie steuern, wann RAG aktiv wird',
    accentColor: 'bg-blue-400',
    accentColorLight: 'bg-blue-500',
    glowColor: 'shadow-blue-500/20',
    bgActive: 'bg-blue-500/8',
    bgActiveLight: 'bg-blue-50',
    dotColor: 'bg-blue-400',
    dotColorLight: 'bg-blue-500',
  },
  {
    mode: 'automatic',
    icon: Brain,
    label: 'Intelligent',
    description: 'KI erkennt relevante Fragen automatisch',
    accentColor: 'bg-emerald-400',
    accentColorLight: 'bg-emerald-500',
    glowColor: 'shadow-emerald-500/20',
    bgActive: 'bg-emerald-500/8',
    bgActiveLight: 'bg-emerald-50',
    dotColor: 'bg-emerald-400',
    dotColorLight: 'bg-emerald-500',
  },
  {
    mode: 'always',
    icon: Zap,
    label: 'Immer An',
    description: 'RAG bei jeder Anfrage aktiv',
    accentColor: 'bg-violet-400',
    accentColorLight: 'bg-violet-500',
    glowColor: 'shadow-violet-500/20',
    bgActive: 'bg-violet-500/8',
    bgActiveLight: 'bg-violet-50',
    dotColor: 'bg-violet-400',
    dotColorLight: 'bg-violet-500',
  }
];

interface RAGSidebarProps {
  /** Whether sidebar is collapsed (for mobile) */
  isCollapsed?: boolean;
}

export function RAGSidebar({ isCollapsed = false }: RAGSidebarProps) {
  const { ragMode, setRAGMode } = useRAG();
  const { isDark } = useTheme();

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="flex flex-col h-full px-3 py-4">
      {/* Header */}
      <div className="mb-5 animate-stagger-1">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`
            p-1.5 rounded-md
            ${isDark ? 'bg-white/5' : 'bg-gray-100'}
          `}>
            <Sparkles size={14} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
          </div>
          <h2 className={`
            text-xs font-semibold uppercase tracking-wider
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `}>
            RAG-Modus
          </h2>
        </div>
        <p className={`
          text-[11px] leading-relaxed pl-0.5
          ${isDark ? 'text-gray-500' : 'text-gray-400'}
        `}>
          Bestimmen Sie, wie Ihre Dokumente in Antworten einfließen
        </p>
      </div>

      {/* Mode Options */}
      <div className="flex flex-col gap-2 mb-4">
        {MODE_OPTIONS.map((option, index) => {
          const Icon = option.icon;
          const isActive = ragMode === option.mode;

          return (
            <button
              key={option.mode}
              onClick={() => setRAGMode(option.mode)}
              className={`
                animate-stagger-${index + 2}
                group relative flex items-center gap-3 px-3 py-3 rounded-xl
                transition-all duration-200 ease-out
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                ${isDark ? 'focus-visible:ring-offset-surface' : 'focus-visible:ring-offset-white'}
                ${isActive
                  ? isDark
                    ? `${option.bgActive} shadow-lg ${option.glowColor}`
                    : `${option.bgActiveLight} shadow-sm`
                  : isDark
                    ? 'hover:bg-white/[0.03]'
                    : 'hover:bg-gray-50'
                }
              `.trim()}
            >
              {/* Left accent bar */}
              <div className={`
                absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full
                transition-all duration-300 ease-out
                ${isActive
                  ? `h-8 ${isDark ? option.accentColor : option.accentColorLight}`
                  : 'h-0 bg-transparent'
                }
              `} />

              {/* Icon container */}
              <div className={`
                relative flex items-center justify-center w-9 h-9 rounded-lg shrink-0
                transition-all duration-200
                ${isActive
                  ? isDark
                    ? 'bg-white/10'
                    : 'bg-white shadow-sm'
                  : isDark
                    ? 'bg-white/5 group-hover:bg-white/8'
                    : 'bg-gray-100 group-hover:bg-gray-200/70'
                }
              `}>
                <Icon
                  size={17}
                  className={`
                    transition-colors duration-200
                    ${isActive
                      ? isDark ? 'text-white' : 'text-gray-900'
                      : isDark ? 'text-gray-500 group-hover:text-gray-400' : 'text-gray-400 group-hover:text-gray-500'
                    }
                  `}
                />
              </div>

              {/* Content */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`
                    text-[13px] font-semibold tracking-tight
                    transition-colors duration-200
                    ${isActive
                      ? isDark ? 'text-white' : 'text-gray-900'
                      : isDark ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-600 group-hover:text-gray-700'
                    }
                  `}>
                    {option.label}
                  </span>
                  {isActive && (
                    <div className="flex items-center gap-1">
                      <div className={`
                        w-1.5 h-1.5 rounded-full animate-pulse-glow
                        ${isDark ? option.dotColor : option.dotColorLight}
                      `} />
                    </div>
                  )}
                </div>
                <p className={`
                  text-[11px] leading-snug mt-0.5 truncate
                  transition-colors duration-200
                  ${isActive
                    ? isDark ? 'text-gray-400' : 'text-gray-500'
                    : isDark ? 'text-gray-600 group-hover:text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                  }
                `}>
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Info box */}
      <div className={`
        animate-stagger-5
        relative overflow-hidden rounded-xl p-3.5
        ${isDark
          ? 'bg-white/[0.02] border border-white/[0.06]'
          : 'bg-gray-50 border border-gray-100'
        }
      `}>
        {/* Subtle gradient overlay */}
        <div className={`
          absolute inset-0 opacity-40
          ${isDark
            ? 'bg-gradient-to-br from-blue-500/5 via-transparent to-violet-500/5'
            : 'bg-gradient-to-br from-blue-50/50 via-transparent to-violet-50/50'
          }
        `} />

        <div className="relative">
          <p className={`
            text-[11px] leading-relaxed
            ${isDark ? 'text-gray-500' : 'text-gray-500'}
          `}>
            <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>RAG</span> durchsucht Ihre hochgeladenen Dokumente und liefert kontextbasierte Antworten mit Quellenangaben.
          </p>
        </div>
      </div>
    </div>
  );
}
