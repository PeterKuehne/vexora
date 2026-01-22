/**
 * VisibilitySelector - Document visibility settings
 *
 * Features:
 * - Department-based visibility options
 * - User-specific access selection
 * - TailwindCSS styling with theme support (MANDATORY)
 * - Integration with user context and department info
 */

import { useState } from 'react';
import { User, Building, Globe, Plus, X } from 'lucide-react';
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
    icon: Plus
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
          block text-sm font-medium mb-3
          ${isDark ? 'text-gray-200' : 'text-gray-800'}
        `}
      >
        Sichtbarkeit
      </label>

      <div className="space-y-3">
        {VISIBILITY_OPTIONS.map((option) => {
          const isSelected = option.type === visibility;
          const Icon = option.icon;

          return (
            <label
              key={option.type}
              className={`
                flex items-start p-3 border rounded-lg cursor-pointer
                transition-colors duration-150
                ${disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : isSelected
                    ? isDark
                      ? 'border-blue-400 bg-blue-900/20'
                      : 'border-blue-500 bg-blue-50'
                    : isDark
                      ? 'border-white/20 hover:border-white/30 hover:bg-white/5'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }
              `}
            >
              <input
                type="radio"
                name="visibility"
                value={option.type}
                checked={isSelected}
                onChange={(e) => !disabled && onVisibilityChange(e.target.value as VisibilityType)}
                disabled={disabled}
                className="sr-only"
              />

              <Icon
                className={`
                  w-5 h-5 mr-3 mt-0.5 flex-shrink-0
                  ${isSelected
                    ? isDark
                      ? 'text-blue-400'
                      : 'text-blue-600'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-gray-500'
                  }
                `}
              />

              <div className="flex-1">
                <div
                  className={`
                    font-medium
                    ${isSelected
                      ? isDark
                        ? 'text-blue-300'
                        : 'text-blue-700'
                      : isDark
                        ? 'text-gray-200'
                        : 'text-gray-900'
                    }
                  `}
                >
                  {option.label}
                  {option.type === 'department' && user?.department && (
                    <span className="text-sm font-normal ml-1">
                      ({user.department})
                    </span>
                  )}
                </div>

                <div
                  className={`
                    text-sm mt-1
                    ${isSelected
                      ? isDark
                        ? 'text-blue-400'
                        : 'text-blue-600'
                      : isDark
                        ? 'text-gray-400'
                        : 'text-gray-500'
                    }
                  `}
                >
                  {option.description}
                </div>
              </div>

              {/* Radio indicator */}
              <div
                className={`
                  w-4 h-4 border-2 rounded-full flex-shrink-0 mt-0.5
                  transition-colors duration-150
                  ${isSelected
                    ? isDark
                      ? 'border-blue-400 bg-blue-400'
                      : 'border-blue-500 bg-blue-500'
                    : isDark
                      ? 'border-gray-500'
                      : 'border-gray-300'
                  }
                `}
              >
                {isSelected && (
                  <div
                    className={`
                      w-1.5 h-1.5 bg-white rounded-full
                      mt-0.5 ml-0.5
                    `}
                  />
                )}
              </div>
            </label>
          );
        })}
      </div>

      {/* Specific Users Input */}
      {visibility === 'specific_users' && (
        <div className="mt-4 p-3 border rounded-lg bg-gray-50/50">
          <label
            className={`
              block text-sm font-medium mb-2
              ${isDark ? 'text-gray-300' : 'text-gray-700'}
            `}
          >
            Benutzer hinzufügen
          </label>

          <div className="flex gap-2">
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="benutzer@example.com"
              disabled={disabled}
              className={`
                flex-1 px-3 py-2 text-sm border rounded
                transition-colors duration-150
                ${isDark
                  ? 'bg-surface-secondary border-white/20 text-gray-200 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }
                ${!disabled && isDark
                  ? 'focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
                  : !disabled
                    ? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    : 'opacity-50 cursor-not-allowed'
                }
              `}
            />

            <button
              type="button"
              onClick={handleAddUser}
              disabled={disabled || !newUserEmail.trim()}
              className={`
                px-3 py-2 text-sm font-medium rounded
                transition-colors duration-150
                ${disabled || !newUserEmail.trim()
                  ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-400'
                  : isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }
              `}
            >
              Hinzufügen
            </button>
          </div>

          {/* Selected Users List */}
          {specificUsers.length > 0 && (
            <div className="mt-3">
              <div
                className={`
                  text-sm font-medium mb-2
                  ${isDark ? 'text-gray-300' : 'text-gray-700'}
                `}
              >
                Ausgewählte Benutzer ({specificUsers.length})
              </div>

              <div className="flex flex-wrap gap-2">
                {specificUsers.map((userEmail, index) => (
                  <div
                    key={index}
                    className={`
                      flex items-center gap-1 px-2 py-1 text-xs rounded
                      ${isDark
                        ? 'bg-surface-secondary text-gray-200'
                        : 'bg-gray-200 text-gray-800'
                      }
                    `}
                  >
                    <span>{userEmail}</span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(userEmail)}
                        className={`
                          p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900
                          transition-colors duration-150
                        `}
                      >
                        <X className="w-3 h-3 text-red-600" />
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
        <p
          className={`
            text-xs mt-2
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `}
        >
          Dokument wird für alle Benutzer in der Abteilung "{user.department}" sichtbar sein
        </p>
      )}
    </div>
  );
}