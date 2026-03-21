/**
 * ClassificationDropdown - Security classification level selector
 *
 * Features:
 * - Role-based permission restrictions
 * - TailwindCSS styling with theme support (MANDATORY)
 * - Clear visual indicators for restriction levels
 * - Refined dropdown with ring-based classification badges
 * - Smooth open/close transitions
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock, Eye, Shield, Users, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

interface ClassificationOption {
  level: ClassificationLevel;
  label: string;
  description: string;
  icon: typeof Eye;
  requiredRole: 'Employee' | 'Manager' | 'Admin';
  colors: {
    icon: { dark: string; light: string };
    selectedBg: { dark: string; light: string };
    accent: { dark: string; light: string };
    ring: { dark: string; light: string };
  };
}

const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  {
    level: 'public',
    label: 'Öffentlich',
    description: 'Für alle Benutzer sichtbar, keine Einschränkungen',
    icon: Eye,
    requiredRole: 'Employee',
    colors: {
      icon: { dark: 'text-emerald-400', light: 'text-emerald-600' },
      selectedBg: { dark: 'bg-emerald-500/10', light: 'bg-emerald-50' },
      accent: { dark: 'text-emerald-400', light: 'text-emerald-600' },
      ring: { dark: 'ring-emerald-500/20', light: 'ring-emerald-200/60' }
    }
  },
  {
    level: 'internal',
    label: 'Intern',
    description: 'Nur für Mitarbeiter der gleichen Abteilung',
    icon: Users,
    requiredRole: 'Employee',
    colors: {
      icon: { dark: 'text-blue-400', light: 'text-blue-600' },
      selectedBg: { dark: 'bg-blue-500/10', light: 'bg-blue-50' },
      accent: { dark: 'text-blue-400', light: 'text-blue-600' },
      ring: { dark: 'ring-blue-500/20', light: 'ring-blue-200/60' }
    }
  },
  {
    level: 'confidential',
    label: 'Vertraulich',
    description: 'Nur für Manager und höhere Rollen',
    icon: Shield,
    requiredRole: 'Manager',
    colors: {
      icon: { dark: 'text-amber-400', light: 'text-amber-600' },
      selectedBg: { dark: 'bg-amber-500/10', light: 'bg-amber-50' },
      accent: { dark: 'text-amber-400', light: 'text-amber-600' },
      ring: { dark: 'ring-amber-500/20', light: 'ring-amber-200/60' }
    }
  },
  {
    level: 'restricted',
    label: 'Eingeschränkt',
    description: 'Nur für Administratoren',
    icon: Lock,
    requiredRole: 'Admin',
    colors: {
      icon: { dark: 'text-red-400', light: 'text-red-600' },
      selectedBg: { dark: 'bg-red-500/10', light: 'bg-red-50' },
      accent: { dark: 'text-red-400', light: 'text-red-600' },
      ring: { dark: 'ring-red-500/20', light: 'ring-red-200/60' }
    }
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
  const currentOption = CLASSIFICATION_OPTIONS.find(opt => opt.level === value) || CLASSIFICATION_OPTIONS[1];

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

  const CurrentIcon = currentOption.icon;

  return (
    <div ref={dropdownRef} className="relative">
      <label
        className={`
          block text-xs font-semibold uppercase tracking-wider mb-2
          ${isDark ? 'text-gray-400' : 'text-gray-500'}
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
          px-3.5 py-2.5 text-left rounded-xl
          transition-all duration-150
          ${disabled
            ? isDark
              ? 'bg-white/[0.02] border border-white/[0.04] text-gray-600 cursor-not-allowed'
              : 'bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed'
            : isDark
              ? 'bg-white/[0.03] border border-white/[0.06] text-gray-200 hover:border-white/[0.12]'
              : 'bg-white border border-gray-200/80 text-gray-900 hover:border-gray-300 shadow-sm'
          }
          ${isOpen && !disabled
            ? isDark
              ? 'border-white/[0.15] ring-1 ring-white/[0.08]'
              : 'border-gray-300 ring-1 ring-gray-200'
            : ''
          }
        `}
      >
        <div className="flex items-center gap-2.5">
          <div className={`
            p-1.5 rounded-lg
            ${isDark ? currentOption.colors.selectedBg.dark : currentOption.colors.selectedBg.light}
          `}>
            <CurrentIcon
              className={`
                w-3.5 h-3.5
                ${isDark ? currentOption.colors.icon.dark : currentOption.colors.icon.light}
                ${disabled ? 'opacity-50' : ''}
              `}
            />
          </div>
          <span className="text-sm font-medium">{currentOption.label}</span>
        </div>
        <ChevronDown
          className={`
            w-4 h-4 transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}
            ${disabled ? 'opacity-30' : isDark ? 'text-gray-500' : 'text-gray-400'}
          `}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          className={`
            absolute z-20 w-full mt-1.5
            rounded-xl overflow-hidden
            shadow-xl
            ${isDark
              ? 'bg-surface border border-white/[0.08]'
              : 'bg-white border border-gray-200/80 shadow-lg'
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
                  w-full flex items-center gap-3 px-3.5 py-3 text-left
                  transition-colors duration-100
                  ${isSelected
                    ? isDark
                      ? `${option.colors.selectedBg.dark}`
                      : `${option.colors.selectedBg.light}`
                    : isDark
                      ? 'hover:bg-white/[0.04]'
                      : 'hover:bg-gray-50'
                  }
                `}
              >
                <div className={`
                  p-1.5 rounded-lg
                  ${isSelected
                    ? isDark ? option.colors.selectedBg.dark : option.colors.selectedBg.light
                    : isDark ? 'bg-white/[0.03]' : 'bg-gray-50'
                  }
                `}>
                  <Icon
                    className={`
                      w-3.5 h-3.5
                      ${isDark ? option.colors.icon.dark : option.colors.icon.light}
                    `}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`
                    text-sm font-medium
                    ${isSelected
                      ? isDark ? option.colors.accent.dark : option.colors.accent.light
                      : isDark ? 'text-gray-200' : 'text-gray-900'
                    }
                  `}>
                    {option.label}
                  </div>
                  <div className={`
                    text-xs mt-0.5 truncate
                    ${isSelected
                      ? isDark ? 'text-gray-400' : 'text-gray-500'
                      : isDark ? 'text-gray-500' : 'text-gray-400'
                    }
                  `}>
                    {option.description}
                  </div>
                </div>

                {isSelected && (
                  <Check className={`
                    w-4 h-4 shrink-0
                    ${isDark ? option.colors.accent.dark : option.colors.accent.light}
                  `} />
                )}
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
                  w-full flex items-center gap-3 px-3.5 py-3
                  ${isDark ? 'border-t border-white/[0.04]' : 'border-t border-gray-100'}
                `}
              >
                <div className={`
                  p-1.5 rounded-lg opacity-30
                  ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'}
                `}>
                  <Icon className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0 opacity-40">
                  <div className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {option.label}
                  </div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                    Nur für {option.requiredRole}+ verfügbar
                  </div>
                </div>
                <Lock className={`w-3 h-3 shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              </div>
            );
          })}
        </div>
      )}

      {/* User Role Info */}
      <p className={`
        text-[11px] mt-2 tabular-nums
        ${isDark ? 'text-gray-600' : 'text-gray-400'}
      `}>
        Ihre Rolle: {user?.role || 'Unbekannt'} &middot; {availableOptions.length}/{CLASSIFICATION_OPTIONS.length} Level verfügbar
      </p>
    </div>
  );
}
