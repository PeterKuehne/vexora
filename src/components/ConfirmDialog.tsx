/**
 * ConfirmDialog Component
 * Reusable confirmation dialog using Headless UI
 * Replaces browser's default confirm() with a styled dialog
 */

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Text for confirm button (default: "Bestätigen") */
  confirmText?: string;
  /** Text for cancel button (default: "Abbrechen") */
  cancelText?: string;
  /** Confirm button variant (default: "danger") */
  confirmVariant?: 'primary' | 'danger';
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Callback when user cancels or closes dialog */
  onCancel: () => void;
}

/**
 * Reusable Confirmation Dialog Component
 *
 * Features:
 * - Title and message display
 * - Confirm/Cancel buttons
 * - Dark/Light theme support
 * - Keyboard navigation (ESC to cancel)
 * - Focus management
 * - Smooth transitions
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showConfirm}
 *   title="Unterhaltung löschen"
 *   message="Möchten Sie diese Unterhaltung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
 *   onConfirm={() => deleteConversation()}
 *   onCancel={() => setShowConfirm(false)}
 * />
 * ```
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { isDark } = useTheme();

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleCancel}>
        {/* Backdrop */}
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
            className={`
              fixed inset-0 backdrop-blur-sm
              ${isDark ? 'bg-black/60' : 'bg-gray-900/50'}
            `}
          />
        </Transition.Child>

        {/* Dialog Container */}
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
                className={`
                  w-full max-w-md
                  rounded-2xl shadow-2xl
                  transform overflow-hidden
                  transition-all
                  ${isDark
                    ? 'bg-neutral-900 text-white border border-white/[0.06]'
                    : 'bg-white text-gray-900 border border-gray-200/80'
                  }
                `}
              >
                {/* Header */}
                <div className="p-6">
                  <div className="flex items-start gap-3">
                    {/* Icon container */}
                    <div
                      className={`
                        shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                        ${confirmVariant === 'danger'
                          ? isDark
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-red-50 text-red-500'
                          : isDark
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-blue-50 text-blue-500'
                        }
                      `}
                    >
                      <AlertTriangle size={18} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <Dialog.Title
                        as="h3"
                        className={`
                          text-[15px] font-semibold
                          ${isDark ? 'text-white' : 'text-gray-900'}
                        `}
                      >
                        {title}
                      </Dialog.Title>

                      {/* Message */}
                      <p
                        className={`
                          mt-2 text-[13px] leading-relaxed whitespace-pre-line
                          ${isDark ? 'text-gray-400' : 'text-gray-600'}
                        `}
                      >
                        {message}
                      </p>
                    </div>

                    {/* Close button */}
                    <button
                      onClick={handleCancel}
                      className={`
                        p-1.5 rounded-xl transition-colors duration-150 shrink-0
                        ${isDark
                          ? 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.06]'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
                        }
                      `}
                      title="Schließen"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Footer - Action Buttons */}
                <div
                  className={`
                    flex gap-3 px-6 py-4
                    border-t
                    ${isDark ? 'border-white/[0.06]' : 'border-gray-200/80'}
                  `}
                >
                  {/* Cancel Button */}
                  <button
                    onClick={handleCancel}
                    className={`
                      flex-1 px-4 py-2 rounded-xl
                      text-[13px] font-medium
                      border transition-all duration-150
                      ${isDark
                        ? 'border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04]'
                        : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-black/[0.02]'
                      }
                    `}
                  >
                    {cancelText}
                  </button>

                  {/* Confirm Button */}
                  <button
                    onClick={handleConfirm}
                    className={`
                      flex-1 px-4 py-2 rounded-xl
                      text-[13px] font-semibold
                      transition-all duration-150
                      ${confirmVariant === 'danger'
                        ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-lg shadow-red-500/10'
                        : isDark
                          ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/5'
                          : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                      }
                    `}
                  >
                    {confirmText}
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

export default ConfirmDialog;
