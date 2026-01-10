/**
 * SaveIndicator Component
 *
 * Visual indicator for auto-save status:
 * - idle: Hidden (no indicator)
 * - saving: Shows spinning loader with "Speichere..."
 * - saved: Shows checkmark with "Gespeichert"
 * - error: Shows error icon with "Fehler beim Speichern"
 */

import { Check, Loader2, AlertCircle, Cloud } from 'lucide-react';
import type { SaveStatus } from '../contexts/ConversationContext';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
  className?: string;
}

export function SaveIndicator({ status, lastSavedAt, className = '' }: SaveIndicatorProps) {
  // Don't render anything when idle
  if (status === 'idle') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          text: 'Speichere...',
          textColor: 'text-gray-400',
          bgColor: 'bg-gray-800/50',
        };
      case 'saved':
        return {
          icon: <Check className="w-3.5 h-3.5" />,
          text: lastSavedAt ? formatTimeSince(lastSavedAt) : 'Gespeichert',
          textColor: 'text-green-400',
          bgColor: 'bg-green-900/30',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          text: 'Fehler beim Speichern',
          textColor: 'text-red-400',
          bgColor: 'bg-red-900/30',
        };
      default:
        return {
          icon: <Cloud className="w-3.5 h-3.5" />,
          text: '',
          textColor: 'text-gray-400',
          bgColor: 'bg-gray-800/50',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs
        ${config.bgColor} ${config.textColor}
        transition-all duration-300 ease-in-out
        ${className}
      `}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}

/**
 * Format time since last save
 */
function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) {
    return 'Gerade gespeichert';
  }
  if (seconds < 60) {
    return `Vor ${seconds}s gespeichert`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Vor ${minutes}m gespeichert`;
  }

  return 'Gespeichert';
}
