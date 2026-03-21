/**
 * VisibilitySelector - Document visibility settings
 *
 * Features:
 * - Department-based visibility options
 * - User-specific access selection
 * - TailwindCSS styling with theme support (MANDATORY)
 * - Refined radio cards with left-accent indicator
 * - Elegant specific users input with pill badges
 */

import { useState } from 'react';
import { User, Building, Globe, UserPlus, X, Mail } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export type VisibilityType = 'only_me' | 'department' | 'all_users' | 'specific_users';

interface VisibilityOption {
  type: VisibilityType;
  label: string;
  description: string;
  icon: typeof User;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    type: 'only_me',
    label: 'Nur ich',
    description: 'Nur Sie können dieses Dokument sehen',
    icon: User
  },
  {
    type: 'department',
    label: 'Meine Abteilung',
    description: 'Alle Mitarbeiter Ihrer Abteilung können das Dokument sehen',
    icon: Building
  },
  {
    type: 'all_users',
    label: 'Alle Benutzer',
    description: 'Alle angemeldeten Benutzer können das Dokument sehen',
    icon: Globe
  },
  {
    type: 'specific_users',
    label: 'Bestimmte Benutzer',
    description: 'Nur ausgewählte Benutzer können das Dokument sehen',
    icon: UserPlus
  }
];

interface VisibilitySelectorProps {
  visibility: VisibilityType;
  onVisibilityChange: (visibility: VisibilityType) => void;
  specificUsers: string[];
  onSpecificUsersChange: (users: string[]) => void;
  disabled?: boolean;
}

export function VisibilitySelector({
  visibility,
  onVisibilityChange,
  specificUsers,
  onSpecificUsersChange,
  disabled = false
}: VisibilitySelectorProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [newUserEmail, setNewUserEmail] = useState('');

  const handleAddUser = () => {
    if (newUserEmail.trim() && !specificUsers.includes(newUserEmail.trim())) {
      onSpecificUsersChange([...specificUsers, newUserEmail.trim()]);
      setNewUserEmail('');
    }
  };

  const handleRemoveUser = (userToRemove: string) => {
    onSpecificUsersChange(specificUsers.filter(u => u !== userToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUser();
    }
  };

  return (
    <div>
      <label
        className={`
          block text-xs font-semibold uppercase tracking-wider mb-2.5
          ${isDark ? 'text-gray-400' : 'text-gray-500'}
        `}
      >
        Sichtbarkeit
      </label>

      <div className="space-y-2">
        {VISIBILITY_OPTIONS.map((option) => {
          const isSelected = option.type === visibility;
          const Icon = option.icon;

          return (
            <label
              key={option.type}
              className={`
                group flex items-center gap-3 p-3 rounded-xl cursor-pointer
                transition-all duration-150 relative overflow-hidden
                ${disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : isSelected
                    ? isDark
                      ? 'bg-white/[0.05] border border-white/[0.12]'
                      : 'bg-gray-50 border border-gray-200 shadow-sm'
                    : isDark
                      ? 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.08]'
                      : 'bg-white border border-gray-200/60 hover:border-gray-200 hover:shadow-sm'
                }
              `}
            >
              {/* Left accent bar for selected state */}
              {isSelected && (
                <div className={`
                  absolute left-0 top-2 bottom-2 w-0.5 rounded-full
                  ${isDark ? 'bg-white/40' : 'bg-gray-900/30'}
                `} />
              )}

              <input
                type="radio"
                name="visibility"
                value={option.type}
                checked={isSelected}
                onChange={(e) => !disabled && onVisibilityChange(e.target.value as VisibilityType)}
                disabled={disabled}
                className="sr-only"
              />

              {/* Icon container */}
              <div className={`
                p-1.5 rounded-lg shrink-0
                ${isSelected
                  ? isDark ? 'bg-white/[0.08]' : 'bg-gray-100'
                  : isDark ? 'bg-white/[0.03]' : 'bg-gray-50'
                }
              `}>
                <Icon
                  className={`
                    w-4 h-4
                    ${isSelected
                      ? isDark ? 'text-white' : 'text-gray-900'
                      : isDark ? 'text-gray-500' : 'text-gray-400'
                    }
                  `}
                />
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div className={`
                  text-sm font-medium leading-tight
                  ${isSelected
                    ? isDark ? 'text-white' : 'text-gray-900'
                    : isDark ? 'text-gray-300' : 'text-gray-700'
                  }
                `}>
                  {option.label}
                  {option.type === 'department' && user?.department && (
                    <span className={`
                      text-xs font-normal ml-1.5
                      ${isDark ? 'text-gray-500' : 'text-gray-400'}
                    `}>
                      ({user.department})
                    </span>
                  )}
                </div>
                <div className={`
                  text-xs mt-0.5
                  ${isSelected
                    ? isDark ? 'text-gray-400' : 'text-gray-500'
                    : isDark ? 'text-gray-600' : 'text-gray-400'
                  }
                `}>
                  {option.description}
                </div>
              </div>

              {/* Radio indicator */}
              <div className={`
                w-4 h-4 rounded-full shrink-0 flex items-center justify-center
                transition-all duration-150
                ${isSelected
                  ? isDark
                    ? 'bg-white ring-1 ring-white/20'
                    : 'bg-gray-900 ring-1 ring-gray-900/10'
                  : isDark
                    ? 'ring-1 ring-white/[0.12]'
                    : 'ring-1 ring-gray-300'
                }
              `}>
                {isSelected && (
                  <div className={`
                    w-1.5 h-1.5 rounded-full
                    ${isDark ? 'bg-gray-900' : 'bg-white'}
                  `} />
                )}
              </div>
            </label>
          );
        })}
      </div>

      {/* Specific Users Input */}
      {visibility === 'specific_users' && (
        <div className={`
          mt-3 p-3.5 rounded-xl
          ${isDark
            ? 'bg-white/[0.02] border border-white/[0.06]'
            : 'bg-gray-50/80 border border-gray-200/60'
          }
        `}>
          <label className={`
            block text-xs font-semibold mb-2
            ${isDark ? 'text-gray-300' : 'text-gray-600'}
          `}>
            Benutzer hinzufügen
          </label>

          <div className="flex gap-2">
            <div className={`
              flex-1 flex items-center gap-2 px-3 py-2 rounded-lg
              transition-all duration-150
              ${isDark
                ? 'bg-white/[0.03] border border-white/[0.06] focus-within:border-white/[0.12]'
                : 'bg-white border border-gray-200 focus-within:border-gray-300 shadow-sm'
              }
            `}>
              <Mail className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="benutzer@example.com"
                disabled={disabled}
                className={`
                  flex-1 text-sm bg-transparent outline-none
                  ${isDark
                    ? 'text-gray-200 placeholder-gray-600'
                    : 'text-gray-900 placeholder-gray-400'
                  }
                  ${disabled ? 'cursor-not-allowed' : ''}
                `}
              />
            </div>

            <button
              type="button"
              onClick={handleAddUser}
              disabled={disabled || !newUserEmail.trim()}
              className={`
                px-3.5 py-2 text-xs font-semibold rounded-lg
                transition-all duration-150 shrink-0
                ${disabled || !newUserEmail.trim()
                  ? 'opacity-30 cursor-not-allowed'
                  : ''
                }
                ${isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
                }
              `}
            >
              Hinzufügen
            </button>
          </div>

          {/* Selected Users List */}
          {specificUsers.length > 0 && (
            <div className="mt-3">
              <div className={`
                text-[11px] font-medium uppercase tracking-wider mb-2
                ${isDark ? 'text-gray-500' : 'text-gray-400'}
              `}>
                Ausgewählt ({specificUsers.length})
              </div>

              <div className="flex flex-wrap gap-1.5">
                {specificUsers.map((userEmail, index) => (
                  <div
                    key={index}
                    className={`
                      group/pill flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg
                      ${isDark
                        ? 'bg-white/[0.05] text-gray-300 ring-1 ring-white/[0.06]'
                        : 'bg-white text-gray-700 ring-1 ring-gray-200/80 shadow-sm'
                      }
                    `}
                  >
                    <span className="truncate max-w-[180px]">{userEmail}</span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(userEmail)}
                        className={`
                          p-0.5 rounded-md shrink-0
                          transition-colors duration-100
                          ${isDark
                            ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                          }
                        `}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Department Info */}
      {visibility === 'department' && user?.department && (
        <p className={`
          text-[11px] mt-2
          ${isDark ? 'text-gray-600' : 'text-gray-400'}
        `}>
          Sichtbar für alle Benutzer in „{user.department}"
        </p>
      )}
    </div>
  );
}
