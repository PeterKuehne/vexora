/**
 * RAGSources Component
 *
 * Displays source citations for RAG-enhanced messages.
 * Shows document sources with relevance scores and content previews.
 */

import { FileText, ExternalLink, Hash } from 'lucide-react'
import { cn } from '../utils'
import { useTheme } from '../contexts'
import type { RAGSource } from '../lib/api'

export interface RAGSourcesProps {
  sources: RAGSource[]
  hasRelevantSources: boolean
  className?: string
}

export function RAGSources({
  sources,
  hasRelevantSources,
  className = ''
}: RAGSourcesProps) {
  const { isDark } = useTheme()

  if (!hasRelevantSources || sources.length === 0) {
    return null
  }

  return (
    <div className={cn(
      'mt-3 rounded-lg border p-3 space-y-2',
      isDark
        ? 'bg-gray-800/50 border-gray-700 text-gray-300'
        : 'bg-gray-50 border-gray-200 text-gray-700',
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4" />
        <span className="text-sm font-medium">
          Quellen ({sources.length})
        </span>
      </div>

      {/* Sources List */}
      <div className="space-y-2">
        {sources.map((source, index) => (
          <RAGSourceItem
            key={`${source.documentId}-${source.chunkIndex}`}
            source={source}
            index={index + 1}
          />
        ))}
      </div>
    </div>
  )
}

interface RAGSourceItemProps {
  source: RAGSource
  index: number
}

function RAGSourceItem({ source, index }: RAGSourceItemProps) {
  const { isDark } = useTheme()

  // Calculate relevance color based on score
  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return isDark ? 'text-green-400' : 'text-green-600'
    if (score >= 0.6) return isDark ? 'text-yellow-400' : 'text-yellow-600'
    return isDark ? 'text-orange-400' : 'text-orange-600'
  }

  const getRelevanceLabel = (score: number) => {
    if (score >= 0.8) return 'Hoch'
    if (score >= 0.6) return 'Mittel'
    return 'Niedrig'
  }

  return (
    <div className={cn(
      'rounded border p-3 space-y-2 transition-colors',
      isDark
        ? 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'
        : 'bg-white border-gray-200 hover:bg-gray-50'
    )}>
      {/* Source Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium',
              isDark
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-800'
            )}>
              {index}
            </span>
            <span className="text-sm font-medium truncate">
              {source.documentName}
            </span>
          </div>

          {/* Document Meta */}
          <div className="flex items-center gap-3 mt-1 text-xs">
            {source.pageNumber && (
              <span className={cn(
                'flex items-center gap-1',
                isDark ? 'text-gray-400' : 'text-gray-500'
              )}>
                <Hash className="w-3 h-3" />
                Seite {source.pageNumber}
              </span>
            )}
            <span className={cn(
              'flex items-center gap-1',
              getRelevanceColor(source.score)
            )}>
              <ExternalLink className="w-3 h-3" />
              {getRelevanceLabel(source.score)} ({(source.score * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      {source.content && (
        <div className={cn(
          'text-xs leading-relaxed p-2 rounded border-l-2',
          isDark
            ? 'bg-gray-800/50 border-l-gray-600 text-gray-400'
            : 'bg-gray-50 border-l-gray-300 text-gray-600'
        )}>
          <span className="italic">&ldquo;</span>
          {source.content}
          <span className="italic">&rdquo;</span>
        </div>
      )}
    </div>
  )
}