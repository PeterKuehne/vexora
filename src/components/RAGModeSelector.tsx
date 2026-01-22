/**
 * RAGModeSelector Component
 *
 * Allows user to choose between different RAG activation modes:
 * - Manual: User controls RAG with toggle
 * - Automatic: AI detects intent and activates RAG intelligently
 * - Always: RAG always active for all queries
 */

import { Brain, Hand, Zap } from 'lucide-react';
import { useTheme } from '../contexts';
import type { RAGMode } from '../contexts/RAGContext';

export interface RAGModeSelectorProps {
  /** Current RAG mode */
  mode: RAGMode;
  /** Called when mode changes */
  onChange: (mode: RAGMode) => void;
  /** Whether RAG is available (documents exist) */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

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

export function RAGModeSelector({ mode, onChange, disabled = false, className = '' }: RAGModeSelectorProps) {
  const { isDark } = useTheme();

  const getColorClasses = (optionColor: 'blue' | 'green' | 'purple', isActive: boolean) => {
    const colorMap = {
      blue: {
        active: isDark ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-blue-100 border-blue-500 text-blue-700',
        inactive: isDark ? 'border-gray-700 text-gray-400 hover:border-blue-500/50' : 'border-gray-200 text-gray-600 hover:border-blue-300'
      },
      green: {
        active: isDark ? 'bg-green-500/20 border-green-400 text-green-300' : 'bg-green-100 border-green-500 text-green-700',
        inactive: isDark ? 'border-gray-700 text-gray-400 hover:border-green-500/50' : 'border-gray-200 text-gray-600 hover:border-green-300'
      },
      purple: {
        active: isDark ? 'bg-purple-500/20 border-purple-400 text-purple-300' : 'bg-purple-100 border-purple-500 text-purple-700',
        inactive: isDark ? 'border-gray-700 text-gray-400 hover:border-purple-500/50' : 'border-gray-200 text-gray-600 hover:border-purple-300'
      }
    };

    return isActive ? colorMap[optionColor].active : colorMap[optionColor].inactive;
  };

  return (
    <div className={`${className}`}>
      <div className="flex flex-col gap-2">
        <label className={`
          text-xs font-medium uppercase tracking-wider
          ${isDark ? 'text-gray-400' : 'text-gray-600'}
        `}>
          RAG Modus
        </label>

        <div className="flex gap-2">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = mode === option.mode;

            return (
              <button
                key={option.mode}
                onClick={() => !disabled && onChange(option.mode)}
                disabled={disabled}
                className={`
                  flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg border-2
                  transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  ${getColorClasses(option.color, isActive)}
                  ${disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:shadow-sm'
                  }
                  ${isDark ? 'focus-visible:ring-offset-gray-800' : 'focus-visible:ring-offset-white'}
                `.trim()}
                title={option.description}
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">
                  {option.label}
                </span>
                {isActive && (
                  <div className={`
                    w-1.5 h-1.5 rounded-full
                    ${option.color === 'blue'
                      ? (isDark ? 'bg-blue-400' : 'bg-blue-500')
                      : option.color === 'green'
                      ? (isDark ? 'bg-green-400' : 'bg-green-500')
                      : (isDark ? 'bg-purple-400' : 'bg-purple-500')
                    }
                  `} />
                )}
              </button>
            );
          })}
        </div>

        {/* Description for current mode */}
        <p className={`
          text-xs leading-relaxed
          ${isDark ? 'text-gray-500' : 'text-gray-500'}
        `}>
          {MODE_OPTIONS.find(option => option.mode === mode)?.description}
        </p>
      </div>
    </div>
  );
}