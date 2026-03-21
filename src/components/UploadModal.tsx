/**
 * UploadModal - Refined modal for document upload
 *
 * Features:
 * - Refined modal design with glass-morphic backdrop
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
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
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
          absolute inset-0 bg-black/60 backdrop-blur-sm
          transition-opacity duration-150
          ${isAnimating ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin
          rounded-2xl shadow-2xl
          transition-all duration-200 ease-out
          ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-2'}
          ${isDark
            ? 'bg-surface border border-white/[0.08]'
            : 'bg-white border border-gray-200/80'
          }
        `}
      >
        {/* Header */}
        <div
          className={`
            sticky top-0 z-10 flex items-center justify-between
            px-6 py-4 border-b
            ${isDark
              ? 'bg-surface/95 backdrop-blur-md border-white/[0.06]'
              : 'bg-white/95 backdrop-blur-md border-gray-100'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-xl
              ${isDark ? 'bg-white/5' : 'bg-gray-50'}
            `}>
              <Upload
                size={18}
                className={isDark ? 'text-gray-300' : 'text-gray-600'}
              />
            </div>
            <div>
              <h2 className={`
                text-base font-semibold
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Dokument hochladen
              </h2>
              <p className={`
                text-xs
                ${isDark ? 'text-gray-500' : 'text-gray-400'}
              `}>
                Datei mit Berechtigungen und Klassifizierung hochladen
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className={`
              p-2 rounded-xl
              transition-colors duration-150
              ${isDark
                ? 'hover:bg-white/5 text-gray-500 hover:text-gray-300'
                : 'hover:bg-gray-100 text-gray-300 hover:text-gray-500'
              }
            `}
          >
            <X size={18} />
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
