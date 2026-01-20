/**
 * WelcomeScreen Component
 *
 * Empty state welcome screen that displays when no conversation is active.
 * Features:
 * - Qwen Chat logo and branding
 * - Welcome message and description
 * - Interactive example prompts that users can click to start chatting
 * - Responsive design for mobile and desktop
 */

import { Bot, MessageSquare, Code, Lightbulb, Sparkles } from 'lucide-react';

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

// Predefined example prompts for common use cases
export const DEFAULT_EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'creative',
    icon: <Sparkles size={20} className="text-purple-500" />,
    title: 'Kreative Hilfe',
    prompt: 'Schreibe eine kurze Geschichte über einen Roboter, der lernt zu träumen.',
    description: 'Kreatives Schreiben und Brainstorming',
  },
  {
    id: 'coding',
    icon: <Code size={20} className="text-blue-500" />,
    title: 'Code-Beispiel',
    prompt: 'Erkläre mir, wie ich einen React Hook für das Laden von Daten aus einer API erstelle.',
    description: 'Programmierung und Code-Erklärungen',
  },
  {
    id: 'explanation',
    icon: <Lightbulb size={20} className="text-yellow-500" />,
    title: 'Erklärung',
    prompt: 'Erkläre mir einfach, wie maschinelles Lernen funktioniert.',
    description: 'Verständliche Erklärungen zu komplexen Themen',
  },
  {
    id: 'conversation',
    icon: <MessageSquare size={20} className="text-green-500" />,
    title: 'Unterhaltung',
    prompt: 'Erzähl mir etwas Interessantes über das Universum.',
    description: 'Offene Gespräche und interessante Fakten',
  },
];

export function WelcomeScreen({ onExamplePromptClick, className }: WelcomeScreenProps) {
  const handlePromptClick = (prompt: string) => {
    onExamplePromptClick?.(prompt);
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] max-w-4xl mx-auto px-6 py-12 text-center ${className || ''}`}>
      {/* Logo and Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Bot size={48} className="text-primary" />
          <div className="text-left">
            <h1 className="text-3xl font-bold text-foreground">Vexora</h1>
            <p className="text-lg text-muted-foreground">KI-Assistent powered by Ollama</p>
          </div>
        </div>
      </div>

      {/* Welcome Content */}
      <div className="mb-10 space-y-4">
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          Willkommen bei deinem lokalen KI-Assistenten
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Vexora läuft komplett lokal über Ollama. Deine Daten bleiben privat und sicher auf deinem Gerät.
          Starte eine Unterhaltung oder wähle eines der Beispiele unten.
        </p>
      </div>

      {/* Example Prompts */}
      <div className="w-full">
        <h3 className="text-lg font-medium text-foreground mb-6">Probiere eines dieser Beispiele aus:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {DEFAULT_EXAMPLE_PROMPTS.map((example) => (
            <ExamplePromptCard
              key={example.id}
              example={example}
              onClick={() => handlePromptClick(example.prompt)}
            />
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-10 text-sm text-muted-foreground/80">
        <p>Powered by Qwen 3 • Läuft komplett offline • Privacy-First</p>
      </div>
    </div>
  );
}

interface ExamplePromptCardProps {
  example: ExamplePrompt;
  onClick: () => void;
}

function ExamplePromptCard({ example, onClick }: ExamplePromptCardProps) {
  return (
    <button
      onClick={onClick}
      className="group p-4 rounded-xl border border-border bg-surface hover:bg-surface/80 text-left transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-background group-hover:bg-primary/10 transition-colors">
          {example.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">
            {example.title}
          </h4>
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {example.description}
          </p>
          <div className="text-xs text-muted-foreground/70 font-mono bg-background/50 p-2 rounded border group-hover:bg-primary/5 transition-colors">
            "{example.prompt.length > 60 ? `${example.prompt.substring(0, 60)}...` : example.prompt}"
          </div>
        </div>
      </div>
    </button>
  );
}

// Compact version for smaller spaces
export function WelcomeScreenCompact({ onExamplePromptClick, className }: WelcomeScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className || ''}`}>
      <Bot size={32} className="text-primary mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">Willkommen bei Vexora</h2>
      <p className="text-muted-foreground text-sm mb-6 max-w-md">
        Starte eine Unterhaltung mit deinem lokalen KI-Assistenten
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {DEFAULT_EXAMPLE_PROMPTS.slice(0, 2).map((example) => (
          <button
            key={example.id}
            onClick={() => onExamplePromptClick?.(example.prompt)}
            className="px-3 py-2 text-xs rounded-lg border border-border bg-surface hover:bg-surface/80 transition-colors"
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
  return (
    <div className={`flex flex-col items-center justify-center py-6 px-4 text-center ${className || ''}`}>
      <Bot size={24} className="text-primary mb-3" />
      <h3 className="text-lg font-medium text-foreground mb-2">Vexora</h3>
      <p className="text-sm text-muted-foreground">Schreibe eine Nachricht um zu starten</p>
    </div>
  );
}