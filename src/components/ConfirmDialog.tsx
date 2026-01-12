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

  // Button styles based on variant and theme
  const confirmButtonStyles =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white';

  const cancelButtonStyles = isDark
    ? 'border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white focus:ring-gray-500'
    : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 focus:ring-gray-500';

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
              fixed inset-0
              ${isDark ? 'bg-black/50' : 'bg-gray-900/50'}
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
                  rounded-lg shadow-xl
                  transform overflow-hidden
                  transition-all
                  ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
                `}
              >
                {/* Header */}
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    {/* Warning Icon */}
                    <div
                      className={`
                        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                        ${confirmVariant === 'danger'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                        }
                        ${isDark && confirmVariant === 'danger'
                          ? 'bg-red-900/30 text-red-400'
                          : isDark && confirmVariant === 'primary'
                          ? 'bg-blue-900/30 text-blue-400'
                          : ''
                        }
                      `}
                    >
                      <AlertTriangle size={20} />
                    </div>

                    <div className="flex-1">
                      {/* Title */}
                      <Dialog.Title as="h3" className="text-lg font-semibold">
                        {title}
                      </Dialog.Title>

                      {/* Message */}
                      <p
                        className={`
                          mt-2 text-sm
                          ${isDark ? 'text-gray-300' : 'text-gray-600'}
                        `}
                      >
                        {message}
                      </p>
                    </div>

                    {/* Close button */}
                    <button
                      onClick={handleCancel}
                      className={`
                        p-2 rounded-lg transition-colors
                        ${isDark
                          ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }
                      `}
                      title="Schließen"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Footer - Action Buttons */}
                <div
                  className={`
                    flex gap-3 px-6 py-4
                    border-t
                    ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}
                  `}
                >
                  {/* Cancel Button */}
                  <button
                    onClick={handleCancel}
                    className={`
                      flex-1 px-4 py-2 rounded-lg
                      text-sm font-medium
                      border transition-all
                      focus:outline-none focus:ring-2 focus:ring-offset-2
                      ${isDark ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}
                      ${cancelButtonStyles}
                    `}
                  >
                    {cancelText}
                  </button>

                  {/* Confirm Button */}
                  <button
                    onClick={handleConfirm}
                    className={`
                      flex-1 px-4 py-2 rounded-lg
                      text-sm font-medium
                      transition-all
                      focus:outline-none focus:ring-2 focus:ring-offset-2
                      ${isDark ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}
                      ${confirmButtonStyles}
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