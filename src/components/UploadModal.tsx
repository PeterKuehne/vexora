/**
 * UploadModal - Clean modal for document upload with fade animation
 *
 * Features:
 * - Compact modal design
 * - Contains DocumentUploadWithPermissions
 * - Smooth fade-in/fade-out animation
 * - Closes on successful upload or cancel
 * - TailwindCSS styling with theme support
 */

import { useEffect, useState, useCallback } from 'react';
import { X, Upload } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DocumentUploadWithPermissions } from './DocumentUploadWithPermissions';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle open/close with animation
  useEffect(() => {
    if (isOpen) {
      // Opening: show immediately, then animate in
      setIsVisible(true);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      // Closing: animate out, then hide
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Handle animation end for closing
  const handleTransitionEnd = useCallback(() => {
    if (!isAnimating && !isOpen) {
      setIsVisible(false);
    }
  }, [isAnimating, isOpen]);

  // Close with animation
  const handleClose = useCallback(() => {
    setIsAnimating(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 150);
  }, [onClose]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-opacity duration-150
        ${isAnimating ? 'opacity-100' : 'opacity-0'}
      `}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-black/50 backdrop-blur-sm
          transition-opacity duration-150
          ${isAnimating ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto
          rounded-xl shadow-2xl
          transition-all duration-150
          ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
          ${isDark ? 'bg-surface' : 'bg-white'}
        `}
      >
        {/* Header */}
        <div
          className={`
            sticky top-0 z-10 flex items-center justify-between
            px-6 py-4 border-b
            ${isDark
              ? 'bg-surface border-white/10'
              : 'bg-white border-gray-200'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}
            `}>
              <Upload
                size={20}
                className={isDark ? 'text-blue-400' : 'text-blue-600'}
              />
            </div>
            <div>
              <h2 className={`
                text-lg font-semibold
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Dokument hochladen
              </h2>
              <p className={`
                text-sm
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                PDF mit Berechtigungen hochladen
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className={`
              p-2 rounded-lg
              transition-colors duration-150
              ${isDark
                ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <DocumentUploadWithPermissions onUploadComplete={handleClose} />
        </div>
      </div>
    </div>
  );
}
