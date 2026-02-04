/**
 * UserMenu Component - User profile dropdown menu with logout functionality
 * Displays user name, role and provides logout option
 * Includes flyout Admin submenu for Admin users (Claude.ai style)
 * Uses MANDATORY TailwindCSS styling with theme support
 */

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronsUpDown, ChevronRight, UserCircle, Users, Shield, Settings } from 'lucide-react';
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
  /** Dropdown direction - 'down' opens below, 'up' opens above */
  dropdownDirection?: 'up' | 'down';
  /** Whether trigger should fill full width */
  fullWidth?: boolean;
}

export function UserMenu({
  user,
  onLogout,
  showRole = true,
  size = 'md',
  dropdownDirection = 'down',
  fullWidth = false
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdminHovered, setIsAdminHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const adminTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Check if user is admin
  const isAdmin = user.role === 'Admin';

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdminHovered(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return;
  }, [isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (adminTimeoutRef.current) {
        clearTimeout(adminTimeoutRef.current);
      }
    };
  }, []);

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

  // Handle admin navigation
  const handleAdminNavigate = (path: string) => {
    setIsOpen(false);
    setIsAdminHovered(false);
    navigate(path);
  };

  // Handle admin hover with delay for better UX
  const handleAdminMouseEnter = () => {
    if (adminTimeoutRef.current) {
      clearTimeout(adminTimeoutRef.current);
    }
    setIsAdminHovered(true);
  };

  const handleAdminMouseLeave = () => {
    adminTimeoutRef.current = setTimeout(() => {
      setIsAdminHovered(false);
    }, 150);
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

  // Menu item base classes
  const menuItemClasses = `
    w-full flex items-center gap-3 px-4 py-2.5
    text-left transition-colors duration-150
    ${isDark
      ? 'text-gray-300 hover:text-white hover:bg-white/10'
      : 'text-gray-700 hover:text-gray-900 hover:bg-black/5'
    }
    focus:outline-none focus:ring-2 focus:ring-inset
    ${isDark ? 'focus:ring-white/20' : 'focus:ring-black/20'}
  `.trim();

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2
          transition-colors duration-150
          focus:outline-none
          ${fullWidth ? 'w-full justify-between' : 'rounded-lg'}
          ${fullWidth ? 'px-0 py-0' : sizeClasses[size]}
          ${isDark
            ? `text-gray-300 hover:text-white ${isOpen ? 'text-white' : ''}`
            : `text-gray-700 hover:text-gray-900 ${isOpen ? 'text-gray-900' : ''}`
          }
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
        <div className={`flex flex-col items-start text-left ${fullWidth ? 'flex-1' : ''}`}>
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
        <ChevronsUpDown
          size={16}
          className={isDark ? 'text-gray-400' : 'text-gray-500'}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute left-0 w-56 rounded-xl shadow-xl
            border z-50
            ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'}
            ${isDark
              ? 'bg-surface border-white/10'
              : 'bg-white border-gray-200'
            }
          `.trim()}
        >
          {/* Email Header */}
          <div
            className={`
              px-4 py-3 border-b
              ${isDark ? 'border-white/10' : 'border-gray-100'}
            `.trim()}
          >
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {user.email}
            </p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Profile Menu Item */}
            <button onClick={handleProfileClick} className={menuItemClasses}>
              <UserCircle
                size={18}
                className={isDark ? 'text-gray-400' : 'text-gray-500'}
              />
              <span>Mein Profil</span>
            </button>

            {/* Admin Section - Only visible for Admins */}
            {isAdmin && (
              <div
                className="relative"
                onMouseEnter={handleAdminMouseEnter}
                onMouseLeave={handleAdminMouseLeave}
              >
                {/* Admin Trigger */}
                <button
                  className={`
                    ${menuItemClasses}
                    justify-between
                    ${isAdminHovered
                      ? isDark
                        ? 'bg-white/10 text-white'
                        : 'bg-black/5 text-gray-900'
                      : ''
                    }
                  `}
                  onClick={() => setIsAdminHovered(!isAdminHovered)}
                >
                  <div className="flex items-center gap-3">
                    <Settings
                      size={18}
                      className={isDark ? 'text-gray-400' : 'text-gray-500'}
                    />
                    <span>Administration</span>
                  </div>
                  <ChevronRight
                    size={16}
                    className={isDark ? 'text-gray-400' : 'text-gray-500'}
                  />
                </button>

                {/* Flyout Submenu - appears to the right */}
                {isAdminHovered && (
                  <div
                    className={`
                      absolute left-full top-0 ml-1 w-52 rounded-xl shadow-xl
                      border z-50
                      ${isDark
                        ? 'bg-surface border-white/10'
                        : 'bg-white border-gray-200'
                      }
                    `.trim()}
                    onMouseEnter={handleAdminMouseEnter}
                    onMouseLeave={handleAdminMouseLeave}
                  >
                    <div className="py-1">
                      <button
                        onClick={() => handleAdminNavigate('/admin')}
                        className={menuItemClasses}
                      >
                        <Users size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                        <span>Benutzer</span>
                      </button>
                      <button
                        onClick={() => handleAdminNavigate('/admin/audit-logs')}
                        className={menuItemClasses}
                      >
                        <Shield size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                        <span>Audit-Logs</span>
                      </button>
                      <button
                        onClick={() => handleAdminNavigate('/admin/settings')}
                        className={menuItemClasses}
                      >
                        <Settings size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                        <span>Einstellungen</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logout Section */}
          <div className={`
            py-1 border-t
            ${isDark ? 'border-white/10' : 'border-gray-100'}
          `}>
            <button onClick={handleLogout} className={menuItemClasses}>
              <LogOut
                size={18}
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
