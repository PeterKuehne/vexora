/**
 * NavigationLinks Component - Main Application Navigation
 * Provides navigation between Chat and Documents pages
 * Follows MANDATORY TailwindCSS styling convention with theme support
 */

import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Users, Shield, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface NavigationLinksProps {
  /** Whether to show icons alongside labels */
  showIcons?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Additional CSS classes */
  className?: string;
}

export function NavigationLinks({
  showIcons = true,
  size = 'md',
  direction = 'horizontal',
  className = '',
}: NavigationLinksProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  // Size classes following TailwindCSS convention
  const sizeClasses = {
    sm: {
      text: 'text-xs',
      icon: 16,
      padding: 'px-2 py-1',
      gap: 'gap-1',
    },
    md: {
      text: 'text-sm',
      icon: 18,
      padding: 'px-3 py-2',
      gap: 'gap-2',
    },
    lg: {
      text: 'text-base',
      icon: 20,
      padding: 'px-4 py-2',
      gap: 'gap-2',
    },
  };

  // Layout classes based on direction
  const layoutClasses = direction === 'horizontal'
    ? `flex items-center ${sizeClasses[size].gap}`
    : `flex flex-col ${sizeClasses[size].gap}`;

  // Base link styling with MANDATORY theme support
  const getLinkClasses = (isActive: boolean) => `
    ${layoutClasses}
    ${sizeClasses[size].padding}
    ${sizeClasses[size].text}
    font-medium rounded-lg
    transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-blue-500
    ${isActive
      ? isDark
        ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
        : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
      : isDark
        ? 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
        : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
    }
  `.trim();

  // Navigation items - Chat und Dokumente werden über die Sidebar-Tabs gesteuert
  // baseNavItems ist leer, da die Hauptnavigation jetzt in der Sidebar ist
  const baseNavItems: Array<{ to: string; label: string; icon: typeof MessageSquare; description: string }> = [];

  // Admin navigation items (only visible to Admins)
  const adminNavItems = user?.role === 'Admin' ? [
    {
      to: '/admin',
      label: 'Benutzer',
      icon: Users,
      description: 'Benutzerverwaltung',
    },
    {
      to: '/admin/audit-logs',
      label: 'Audit-Logs',
      icon: Shield,
      description: 'Systemaktivitäten',
    },
    {
      to: '/admin/settings',
      label: 'Einstellungen',
      icon: Settings,
      description: 'System-Konfiguration',
    },
  ] : [];

  // Combine navigation items
  const navItems = [...baseNavItems, ...adminNavItems];

  return (
    <nav
      className={`${layoutClasses} ${className}`}
      aria-label="Hauptnavigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.to;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={getLinkClasses(isActive)}
            aria-label={`Navigate to ${item.description}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {showIcons && (
              <Icon
                size={sizeClasses[size].icon}
                className="shrink-0"
                aria-hidden="true"
              />
            )}
            <span className="shrink-0">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * NavigationDivider - Visual separator for navigation sections
 * Follows MANDATORY theme styling convention
 */
export function NavigationDivider() {
  const { isDark } = useTheme();
  return (
    <div
      className={`
        w-px h-5
        transition-colors duration-150
        ${isDark ? 'bg-white/20' : 'bg-gray-300'}
      `}
      role="separator"
      aria-hidden="true"
    />
  );
}