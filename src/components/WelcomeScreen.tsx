/**
 * WelcomeScreen Component
 *
 * Empty state welcome screen that displays when no conversation is active.
 * Features:
 * - Refined Monochrome design matching Documents page
 * - Subtle example prompt cards with icon containers
 * - Stagger entrance animations
 * - Privacy-first messaging
 */

import { Bot, MessageSquare, Code, Lightbulb, Sparkles, ArrowRight, Shield } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export interface WelcomeScreenProps {
  /** Callback when user clicks an example prompt */
  onExamplePromptClick?: (prompt: string) => void;
  /** Optional className for styling */
  className?: string | undefined;
}

export interface ExamplePrompt {
  id: string;
  icon: React.ReactNode;
  title: string;
  prompt: string;
  description: string;
}

/**
 * Color configuration per prompt category
 */
const PROMPT_COLORS: Record<string, { iconDark: string; iconLight: string }> = {
  creative: { iconDark: 'bg-violet-500/10 text-violet-400', iconLight: 'bg-violet-50 text-violet-500' },
  coding: { iconDark: 'bg-blue-500/10 text-blue-400', iconLight: 'bg-blue-50 text-blue-500' },
  explanation: { iconDark: 'bg-amber-500/10 text-amber-400', iconLight: 'bg-amber-50 text-amber-500' },
  conversation: { iconDark: 'bg-emerald-500/10 text-emerald-400', iconLight: 'bg-emerald-50 text-emerald-500' },
};

// Predefined example prompts for common use cases
export const DEFAULT_EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'creative',
    icon: <Sparkles size={18} />,
    title: 'Kreative Hilfe',
    prompt: 'Schreibe eine kurze Geschichte über einen Roboter, der lernt zu träumen.',
    description: 'Kreatives Schreiben und Brainstorming',
  },
  {
    id: 'coding',
    icon: <Code size={18} />,
    title: 'Code-Beispiel',
    prompt: 'Erkläre mir, wie ich einen React Hook für das Laden von Daten aus einer API erstelle.',
    description: 'Programmierung und Code-Erklärungen',
  },
  {
    id: 'explanation',
    icon: <Lightbulb size={18} />,
    title: 'Erklärung',
    prompt: 'Erkläre mir einfach, wie maschinelles Lernen funktioniert.',
    description: 'Verständliche Erklärungen zu komplexen Themen',
  },
  {
    id: 'conversation',
    icon: <MessageSquare size={18} />,
    title: 'Unterhaltung',
    prompt: 'Erzähl mir etwas Interessantes über das Universum.',
    description: 'Offene Gespräche und interessante Fakten',
  },
];

export function WelcomeScreen({ onExamplePromptClick, className }: WelcomeScreenProps) {
  const { isDark } = useTheme();

  const handlePromptClick = (prompt: string) => {
    onExamplePromptClick?.(prompt);
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] max-w-3xl mx-auto px-6 py-12 ${className || ''}`}>
      {/* Logo and Header */}
      <div className="flex flex-col items-center mb-10 animate-stagger-1">
        <div className={`
          relative overflow-hidden p-4 rounded-2xl mb-5
          ${isDark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-gray-50 border border-gray-200/60'}
        `}>
          <div className={`
            absolute inset-0 opacity-40
            ${isDark
              ? 'bg-gradient-to-br from-blue-500/5 via-transparent to-violet-500/5'
              : 'bg-gradient-to-br from-blue-50/50 via-transparent to-violet-50/50'
            }
          `} />
          <Bot size={32} className={`relative ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
        </div>
        <h1 className={`
          text-2xl font-bold tracking-tight mb-2
          ${isDark ? 'text-white' : 'text-gray-900'}
        `}>
          Cor7ex
        </h1>
        <p className={`
          text-sm text-center max-w-md leading-relaxed
          ${isDark ? 'text-gray-500' : 'text-gray-400'}
        `}>
          Ihr lokaler KI-Assistent powered by Ollama.
          Daten bleiben privat auf Ihrem Gerät.
        </p>
      </div>

      {/* Example Prompts */}
      <div className="w-full animate-stagger-2">
        <p className={`
          text-xs font-semibold uppercase tracking-wider mb-4 text-center
          ${isDark ? 'text-gray-500' : 'text-gray-400'}
        `}>
          Probieren Sie eines dieser Beispiele
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {DEFAULT_EXAMPLE_PROMPTS.map((example, index) => (
            <button
              key={example.id}
              onClick={() => handlePromptClick(example.prompt)}
              className={`
                animate-stagger-${index + 2}
                group relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-left
                transition-all duration-200 ease-out
                ${isDark
                  ? 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1]'
                  : 'bg-white border border-gray-200/80 hover:bg-gray-50 hover:border-gray-300/80 shadow-sm'
                }
              `}
            >
              {/* Icon container */}
              {(() => {
                const colors = PROMPT_COLORS[example.id] || PROMPT_COLORS.conversation;
                return (
                  <div className={`
                    flex items-center justify-center w-9 h-9 rounded-lg shrink-0
                    transition-colors duration-200
                    ${isDark ? colors.iconDark : colors.iconLight}
                  `}>
                    <span>{example.icon}</span>
                  </div>
                );
              })()}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`
                  text-[13px] font-semibold tracking-tight
                  transition-colors duration-200
                  ${isDark
                    ? 'text-gray-300 group-hover:text-white'
                    : 'text-gray-700 group-hover:text-gray-900'
                  }
                `}>
                  {example.title}
                </p>
                <p className={`
                  text-[11px] mt-0.5 truncate
                  ${isDark ? 'text-gray-600' : 'text-gray-400'}
                `}>
                  {example.description}
                </p>
              </div>

              {/* Arrow */}
              <ArrowRight
                size={14}
                className={`
                  shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
                  transition-all duration-200
                  ${isDark ? 'text-gray-500' : 'text-gray-400'}
                `}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={`
        mt-10 flex items-center gap-1.5 animate-stagger-6
        ${isDark ? 'text-gray-600' : 'text-gray-400'}
      `}>
        <Shield size={11} />
        <p className="text-[11px]">
          Läuft komplett offline · Privacy-First
        </p>
      </div>
    </div>
  );
}

// Compact version for smaller spaces
export function WelcomeScreenCompact({ onExamplePromptClick, className }: WelcomeScreenProps) {
  const { isDark } = useTheme();

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className || ''}`}>
      <div className={`
        p-3 rounded-xl mb-4
        ${isDark ? 'bg-white/[0.04]' : 'bg-gray-50'}
      `}>
        <Bot size={24} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
      </div>
      <h2 className={`text-lg font-bold tracking-tight mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Willkommen bei Cor7ex
      </h2>
      <p className={`text-xs mb-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        Starte eine Unterhaltung mit deinem lokalen KI-Assistenten
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {DEFAULT_EXAMPLE_PROMPTS.slice(0, 2).map((example) => (
          <button
            key={example.id}
            onClick={() => onExamplePromptClick?.(example.prompt)}
            className={`
              px-3 py-2 text-xs rounded-xl font-medium transition-colors
              ${isDark
                ? 'bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]'
                : 'bg-gray-50 border border-gray-200/80 text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            {example.title}
          </button>
        ))}
      </div>
    </div>
  );
}

// Minimal version for very constrained spaces
export function WelcomeScreenMinimal({ className }: WelcomeScreenProps) {
  const { isDark } = useTheme();

  return (
    <div className={`flex flex-col items-center justify-center py-6 px-4 text-center ${className || ''}`}>
      <Bot size={20} className={`mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
      <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Cor7ex</h3>
      <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Schreibe eine Nachricht um zu starten</p>
    </div>
  );
}
