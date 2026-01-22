/**
 * UserMenu Component - User profile dropdown menu with logout functionality
 * Displays user name, role and provides logout option
 * Uses MANDATORY TailwindCSS styling with theme support
 */

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts';
import type { User as UserType } from '../../server/src/types/auth';

export interface UserMenuProps {
  /** Current user */
  user: UserType;
  /** Logout callback */
  onLogout: () => void;
  /** Show user role badge */
  showRole?: boolean;
  /** Menu size */
  size?: 'sm' | 'md' | 'lg';
}

export function UserMenu({
  user,
  onLogout,
  showRole = true,
  size = 'md'
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return; // Explicit return for TypeScript
  }, [isOpen]);

  // Handle logout click
  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  // Handle profile click
  const handleProfileClick = () => {
    setIsOpen(false);
    navigate('/profile');
  };

  // Size variants following TailwindCSS conventions
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3',
  };

  // Role badge styling with theme support
  const roleColors = {
    Admin: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
    Manager: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
    Employee: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 rounded-lg
          transition-colors duration-150
          ${sizeClasses[size]}
          ${isDark
            ? 'text-gray-300 hover:text-white hover:bg-white/10 focus:bg-white/10'
            : 'text-gray-700 hover:text-gray-900 hover:bg-black/10 focus:bg-black/10'
          }
          focus:outline-none focus:ring-2
          ${isDark ? 'focus:ring-white/20' : 'focus:ring-black/20'}
        `.trim()}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Benutzer-Menü für ${user.name}`}
      >
        {/* User Icon */}
        <div
          className={`
            flex items-center justify-center rounded-full
            ${size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10'}
            ${isDark ? 'bg-white/10' : 'bg-black/10'}
          `.trim()}
        >
          <User
            size={size === 'sm' ? 14 : size === 'md' ? 16 : 20}
            className={isDark ? 'text-gray-400' : 'text-gray-600'}
          />
        </div>

        {/* User Info */}
        <div className="flex flex-col items-start text-left">
          <span className="font-medium truncate max-w-32">
            {user.name}
          </span>
          {showRole && (
            <span
              className={`
                px-2 py-0.5 text-xs rounded-full font-medium
                ${roleColors[user.role]}
              `.trim()}
            >
              {user.role}
            </span>
          )}
        </div>

        {/* Dropdown Arrow */}
        <ChevronDown
          size={16}
          className={`
            transition-transform duration-150
            ${isOpen ? 'rotate-180' : 'rotate-0'}
            ${isDark ? 'text-gray-400' : 'text-gray-500'}
          `.trim()}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute right-0 mt-2 w-64 rounded-lg shadow-lg
            border backdrop-blur-sm z-50
            ${isDark
              ? 'bg-gray-800/95 border-white/10'
              : 'bg-white/95 border-gray-200'
            }
          `.trim()}
        >
          {/* User Info Section */}
          <div
            className={`
              px-4 py-3 border-b
              ${isDark ? 'border-white/10' : 'border-gray-200'}
            `.trim()}
          >
            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {user.name}
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {user.email}
            </p>
            {user.department && (
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {user.department}
              </p>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Profile Menu Item */}
            <button
              onClick={handleProfileClick}
              className={`
                w-full flex items-center gap-3 px-4 py-2
                text-left transition-colors duration-150
                ${isDark
                  ? 'text-gray-300 hover:text-white hover:bg-white/10'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-black/5'
                }
                focus:outline-none focus:ring-2 focus:ring-inset
                ${isDark ? 'focus:ring-white/20' : 'focus:ring-black/20'}
              `.trim()}
            >
              <UserCircle
                size={16}
                className={isDark ? 'text-gray-400' : 'text-gray-500'}
              />
              <span>Mein Profil</span>
            </button>

            {/* Logout Menu Item */}
            <button
              onClick={handleLogout}
              className={`
                w-full flex items-center gap-3 px-4 py-2
                text-left transition-colors duration-150
                ${isDark
                  ? 'text-gray-300 hover:text-white hover:bg-white/10'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-black/5'
                }
                focus:outline-none focus:ring-2 focus:ring-inset
                ${isDark ? 'focus:ring-white/20' : 'focus:ring-black/20'}
              `.trim()}
            >
              <LogOut
                size={16}
                className={isDark ? 'text-gray-400' : 'text-gray-500'}
              />
              <span>Abmelden</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * UserMenuSkeleton - Loading placeholder for UserMenu
 */
export function UserMenuSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { isDark } = useTheme();

  const sizeClasses = {
    sm: 'h-8 w-24',
    md: 'h-10 w-32',
    lg: 'h-12 w-40',
  };

  return (
    <div
      className={`
        rounded-lg animate-pulse
        ${sizeClasses[size]}
        ${isDark ? 'bg-white/10' : 'bg-black/10'}
      `.trim()}
    />
  );
}