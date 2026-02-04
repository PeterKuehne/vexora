/**
 * AdminPageHeader Component - Header for Admin pages with back navigation
 * Provides consistent header with back button, title and optional actions
 * Uses MANDATORY TailwindCSS styling with theme support
 */

import { type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

export interface AdminPageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional icon to show before title */
  icon?: ReactNode;
  /** Optional actions to show on the right */
  actions?: ReactNode;
  /** Custom back URL (defaults to /chat) */
  backUrl?: string;
  /** Custom back label */
  backLabel?: string;
}

export function AdminPageHeader({
  title,
  subtitle,
  icon,
  actions,
  backUrl = '/chat',
  backLabel = 'Zurück zum Chat',
}: AdminPageHeaderProps) {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleBack = () => {
    navigate(backUrl);
  };

  return (
    <div className="mb-6">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className={`
          flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg
          text-sm font-medium
          transition-colors duration-150
          ${isDark
            ? 'text-gray-400 hover:text-white hover:bg-white/10'
            : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
          }
        `}
      >
        <ArrowLeft size={16} />
        <span>{backLabel}</span>
      </button>

      {/* Title Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`
              p-2 rounded-lg
              ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}
            `}>
              {icon}
            </div>
          )}
          <div>
            <h1 className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              {title}
            </h1>
            {subtitle && (
              <p className={`
                mt-1 text-sm
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
