/**
 * ClassificationDropdown - Security classification level selector
 *
 * Features:
 * - Role-based permission restrictions
 * - TailwindCSS styling with theme support (MANDATORY)
 * - Clear visual indicators for restriction levels
 * - User-friendly descriptions for each level
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock, Eye, Shield, Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

interface ClassificationOption {
  level: ClassificationLevel;
  label: string;
  description: string;
  icon: typeof Eye;
  requiredRole: 'Employee' | 'Manager' | 'Admin';
  color: string;
}

const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  {
    level: 'public',
    label: 'Öffentlich',
    description: 'Für alle Benutzer sichtbar, keine Einschränkungen',
    icon: Eye,
    requiredRole: 'Employee',
    color: 'text-green-600'
  },
  {
    level: 'internal',
    label: 'Intern',
    description: 'Nur für Mitarbeiter der gleichen Abteilung',
    icon: Users,
    requiredRole: 'Employee',
    color: 'text-blue-600'
  },
  {
    level: 'confidential',
    label: 'Vertraulich',
    description: 'Nur für Manager und höhere Rollen',
    icon: Shield,
    requiredRole: 'Manager',
    color: 'text-orange-600'
  },
  {
    level: 'restricted',
    label: 'Eingeschränkt',
    description: 'Nur für Administratoren',
    icon: Lock,
    requiredRole: 'Admin',
    color: 'text-red-600'
  }
];

interface ClassificationDropdownProps {
  value: ClassificationLevel;
  onChange: (level: ClassificationLevel) => void;
  disabled?: boolean;
}

export function ClassificationDropdown({ value, onChange, disabled = false }: ClassificationDropdownProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine user role hierarchy (Employee < Manager < Admin)
  const getRoleLevel = (role: string): number => {
    switch (role) {
      case 'Admin': return 3;
      case 'Manager': return 2;
      case 'Employee': return 1;
      default: return 0;
    }
  };

  const userRoleLevel = user ? getRoleLevel(user.role) : 0;

  // Filter available options based on user role
  const availableOptions = CLASSIFICATION_OPTIONS.filter(option =>
    getRoleLevel(option.requiredRole) <= userRoleLevel
  );

  // Get current selection
  const currentOption = CLASSIFICATION_OPTIONS.find(opt => opt.level === value) || CLASSIFICATION_OPTIONS[1]; // fallback to 'internal'

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-adjust selection if current level is not allowed for user
  useEffect(() => {
    if (!availableOptions.some(opt => opt.level === value)) {
      // Default to highest available level for the user
      const highestAvailable = availableOptions[availableOptions.length - 1];
      if (highestAvailable) {
        onChange(highestAvailable.level);
      }
    }
  }, [value, onChange, availableOptions]);

  const handleSelect = (level: ClassificationLevel) => {
    onChange(level);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <label
        className={`
          block text-sm font-medium mb-2
          ${isDark ? 'text-gray-200' : 'text-gray-800'}
        `}
      >
        Klassifizierung
      </label>

      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between
          px-3 py-2 text-left border rounded-lg
          transition-colors duration-150
          ${disabled
            ? isDark
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
            : isDark
              ? 'bg-gray-800 border-gray-600 text-gray-200 hover:border-gray-500'
              : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
          }
          ${isOpen && !disabled
            ? isDark
              ? 'border-blue-400 ring-1 ring-blue-400'
              : 'border-blue-500 ring-1 ring-blue-500'
            : ''
          }
        `}
      >
        <div className="flex items-center">
          <currentOption.icon
            className={`
              w-4 h-4 mr-2
              ${currentOption.color}
              ${disabled ? 'opacity-50' : ''}
            `}
          />
          <span className="font-medium">{currentOption.label}</span>
        </div>
        <ChevronDown
          className={`
            w-4 h-4 transition-transform duration-150
            ${isOpen ? 'rotate-180' : ''}
            ${disabled ? 'opacity-50' : ''}
          `}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          className={`
            absolute z-10 w-full mt-1
            border rounded-lg shadow-lg
            ${isDark
              ? 'bg-gray-800 border-gray-600'
              : 'bg-white border-gray-300'
            }
          `}
        >
          {availableOptions.map((option) => {
            const isSelected = option.level === value;
            const Icon = option.icon;

            return (
              <button
                key={option.level}
                type="button"
                onClick={() => handleSelect(option.level)}
                className={`
                  w-full flex items-start px-3 py-3 text-left
                  transition-colors duration-150
                  ${isSelected
                    ? isDark
                      ? 'bg-blue-900/50 text-blue-300'
                      : 'bg-blue-50 text-blue-700'
                    : isDark
                      ? 'text-gray-200 hover:bg-gray-700'
                      : 'text-gray-900 hover:bg-gray-50'
                  }
                  ${option === availableOptions[0] ? 'rounded-t-lg' : ''}
                  ${option === availableOptions[availableOptions.length - 1] ? 'rounded-b-lg' : ''}
                `}
              >
                <Icon
                  className={`
                    w-4 h-4 mr-3 mt-0.5 flex-shrink-0
                    ${option.color}
                  `}
                />
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div
                    className={`
                      text-xs mt-1
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
              </button>
            );
          })}

          {/* Show restricted options as disabled */}
          {CLASSIFICATION_OPTIONS.filter(opt => !availableOptions.includes(opt)).map((option) => {
            const Icon = option.icon;

            return (
              <div
                key={option.level}
                className={`
                  w-full flex items-start px-3 py-3
                  opacity-50 cursor-not-allowed
                  ${isDark ? 'text-gray-500' : 'text-gray-400'}
                `}
              >
                <Icon className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs mt-1">
                    Nur für {option.requiredRole}+ verfügbar
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Role Info */}
      <p
        className={`
          text-xs mt-2
          ${isDark ? 'text-gray-400' : 'text-gray-500'}
        `}
      >
        Ihre Rolle: {user?.role || 'Unbekannt'} • Verfügbare Level: {availableOptions.length}/{CLASSIFICATION_OPTIONS.length}
      </p>
    </div>
  );
}