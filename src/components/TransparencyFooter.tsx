/**
 * TransparencyFooter - Shows model, cost, sources count, and duration per response
 *
 * AI Act Compliance + Cost Transparency
 * Displayed below each AI message.
 */

import { Cloud, Cpu, Clock, FileText, Coins } from 'lucide-react';
import { useTheme } from '../contexts';

export interface TransparencyFooterProps {
  /** Model used for generation */
  model?: string;
  /** Whether it's a cloud model */
  isCloud?: boolean;
  /** Number of RAG sources used */
  sourcesCount?: number;
  /** Generation duration in ms */
  durationMs?: number;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens used */
  outputTokens?: number;
  /** Estimated cost in USD (cloud only) */
  costUsd?: number;
}

export function TransparencyFooter({
  model,
  isCloud,
  sourcesCount,
  durationMs,
  inputTokens,
  outputTokens,
  costUsd,
}: TransparencyFooterProps) {
  const { isDark } = useTheme();

  if (!model) return null;

  const modelName = model.includes(':') ? model.split(':').slice(1).join(':') : model;

  return (
    <div
      className={`
        flex items-center gap-3 mt-1 text-[10px] select-none
        ${isDark ? 'text-white/25' : 'text-gray-400'}
      `}
    >
      {/* Model */}
      <span className="flex items-center gap-1">
        {isCloud ? <Cloud size={9} /> : <Cpu size={9} />}
        {modelName}
      </span>

      {/* Sources */}
      {sourcesCount !== undefined && sourcesCount > 0 && (
        <span className="flex items-center gap-1">
          <FileText size={9} />
          {sourcesCount} Quellen
        </span>
      )}

      {/* Duration */}
      {durationMs !== undefined && durationMs > 0 && (
        <span className="flex items-center gap-1">
          <Clock size={9} />
          {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
        </span>
      )}

      {/* Tokens */}
      {(inputTokens || outputTokens) && (
        <span>
          {inputTokens || 0}/{outputTokens || 0} tok
        </span>
      )}

      {/* Cost (cloud only) */}
      {costUsd !== undefined && costUsd > 0 && (
        <span className="flex items-center gap-1 text-blue-400/50">
          <Coins size={9} />
          ${costUsd.toFixed(4)}
        </span>
      )}
    </div>
  );
}
