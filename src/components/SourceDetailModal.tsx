/**
 * SourceDetailModal Component
 * Modal to display full source content when user clicks on a RAG source citation
 * Shows document name, page number, full chunk content, and metadata
 */

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, FileText, Hash, ExternalLink, Copy, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';
import type { RAGSource } from '../lib/api';

export interface SourceDetailModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The source to display */
  source: RAGSource | null;
  /** Source index for display purposes */
  sourceIndex: number;
  /** Callback when modal should close */
  onClose: () => void;
}

/**
 * Modal to display full RAG source details
 *
 * Features:
 * - Full content display (no truncation)
 * - Document metadata (name, page, chunk index)
 * - Relevance score and color coding
 * - Copy-to-clipboard functionality
 * - Dark/Light theme support
 * - Keyboard navigation (ESC to close)
 * - Focus management
 * - Smooth transitions
 */
export function SourceDetailModal({
  isOpen,
  source,
  sourceIndex,
  onClose
}: SourceDetailModalProps) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  // Don't render if no source
  if (!source) return null;

  // Calculate relevance color based on score
  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return isDark ? 'text-green-400' : 'text-green-600';
    if (score >= 0.6) return isDark ? 'text-yellow-400' : 'text-yellow-600';
    return isDark ? 'text-orange-400' : 'text-orange-600';
  };

  const getRelevanceLabel = (score: number) => {
    if (score >= 0.8) return 'Hoch';
    if (score >= 0.6) return 'Mittel';
    return 'Niedrig';
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Background overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className={`fixed inset-0 ${
              isDark ? 'bg-black/50' : 'bg-gray-900/25'
            }`}
          />
        </Transition.Child>

        {/* Modal container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`w-full max-w-2xl transform overflow-hidden rounded-lg ${
                  isDark
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-900'
                } p-6 shadow-xl transition-all`}
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        isDark
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {sourceIndex}
                    </div>
                    <div>
                      <Dialog.Title
                        as="h2"
                        className={`text-lg font-semibold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        Quelle {sourceIndex}
                      </Dialog.Title>
                      <p
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Original-Textabschnitt
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`rounded-md p-2 transition-colors ${
                      isDark
                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={onClose}
                    aria-label="Modal schließen"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Document Info */}
                <div className="mt-4 space-y-3">
                  {/* Document Name */}
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium text-sm truncate">
                      {source.documentName}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-4 text-xs">
                    {source.pageNumber && (
                      <span
                        className={`flex items-center gap-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        <Hash className="w-3 h-3" />
                        Seite {source.pageNumber}
                      </span>
                    )}
                    <span
                      className={`flex items-center gap-1 ${getRelevanceColor(
                        source.score
                      )}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {getRelevanceLabel(source.score)} (
                      {(source.score * 100).toFixed(0)}%)
                    </span>
                    <span
                      className={`${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      Chunk {source.chunkIndex + 1}
                    </span>
                  </div>
                </div>

                {/* Content Display */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3
                      className={`text-sm font-medium ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      Vollständiger Text
                    </h3>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                        copied
                          ? isDark
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 text-green-800'
                          : isDark
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                      }`}
                      aria-label="Text kopieren"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Kopiert!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Kopieren
                        </>
                      )}
                    </button>
                  </div>

                  {/* Full Content */}
                  <div
                    className={`p-4 rounded-lg border max-h-96 overflow-y-auto ${
                      isDark
                        ? 'bg-gray-900/50 border-gray-700 text-gray-300'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      <span className="italic">&ldquo;</span>
                      {source.content}
                      <span className="italic">&rdquo;</span>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isDark
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                    }`}
                  >
                    Schließen
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}