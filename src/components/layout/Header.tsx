/**
 * Header Component - Main Application Header
 * Displays logo/title on the left and controls (theme toggle, status) on the right
 * Fixed positioning at the top of the viewport
 */

import { type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useTheme } from '../../contexts';
import type { Theme } from '../../types/settings';
import type { User } from '../../../server/src/types/auth';
import { Logo } from '../Logo';
import { ModelSelector } from '../ModelSelector';
import { NavigationLinks, NavigationDivider } from '../NavigationLinks';
import { NewChatButton } from '../NewChatButton';
import { SettingsButton } from '../SettingsButton';
import { ThemeToggle } from '../ThemeToggle';
import { UserMenu, UserMenuSkeleton } from '../UserMenu';

export interface HeaderProps {
  /** Callback to create a new conversation */
  onNewConversation?: () => void;
  /** Current theme */
  theme: Theme;
  /** Callback to change theme */
  onThemeChange: (theme: Theme) => void;
  /** Whether Ollama is connected */
  isOllamaConnected: boolean | null;
  /** Number of available models */
  modelCount: number;
  /** Save status indicator component */
  saveIndicator?: ReactNode;
  /** Whether to show mobile menu button */
  showMobileMenu?: boolean;
  /** Callback to toggle sidebar */
  onToggleSidebar?: () => void;
  /** Whether sidebar is collapsed */
  isSidebarCollapsed?: boolean;
  /** Whether sidebar exists */
  hasSidebar?: boolean;
  /** Currently selected model */
  selectedModel?: string | undefined;
  /** Callback when model is changed */
  onModelChange?: (modelId: string) => void;
  /** Whether to show model selector */
  showModelSelector?: boolean;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
  /** Whether to show settings button */
  showSettingsButton?: boolean;
  /** Current authenticated user (null if not authenticated) */
  user?: User | null;
  /** Whether auth is loading */
  isAuthLoading?: boolean;
  /** Callback when user clicks logout */
  onLogout?: () => void;
  /** Whether to show user menu */
  showUserMenu?: boolean;
}

// Theme toggle logic is now in ThemeToggle component

export function Header({
  onNewConversation,
  theme,
  onThemeChange,
  isOllamaConnected,
  modelCount,
  saveIndicator,
  showMobileMenu = true,
  onToggleSidebar,
  isSidebarCollapsed = false,
  hasSidebar = false,
  selectedModel,
  onModelChange,
  showModelSelector = true,
  onSettingsClick,
  showSettingsButton = true,
  user,
  isAuthLoading = false,
  onLogout,
  showUserMenu = true,
}: HeaderProps) {
  const { isDark } = useTheme();

  // Connection status styling
  const connectionStatusColor =
    isOllamaConnected === null
      ? 'bg-yellow-500'
      : isOllamaConnected
        ? 'bg-green-500'
        : 'bg-red-500';

  const connectionStatusText =
    isOllamaConnected === null
      ? 'Verbinde...'
      : isOllamaConnected
        ? `Ollama (${modelCount} ${modelCount === 1 ? 'Modell' : 'Modelle'})`
        : 'Ollama nicht verbunden';

  return (
    <header
      className={`
        flex items-center justify-between
        px-4 py-3
        border-b
        shrink-0
        ${isDark ? 'border-white/10' : 'border-gray-200'}
      `.trim()}
    >
      {/* Left Section: Mobile Menu + Logo/Title + New Button */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button - visible on mobile/tablet */}
        {showMobileMenu && hasSidebar && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`
              touch-target p-2 rounded-lg transition-colors
              lg:hidden
              ${
                isDark
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
              }
            `.trim()}
            title="Sidebar umschalten"
            aria-label="Toggle sidebar"
            aria-expanded={!isSidebarCollapsed}
          >
            <Menu size={20} />
          </button>
        )}

        {/* Logo/Title */}
        <Logo size="md" />

        {/* Navigation Links - Chat | Dokumente */}
        <NavigationDivider />
        <NavigationLinks
          showIcons={false}
          size="sm"
          direction="horizontal"
          className="hidden sm:flex"
        />

        {/* New Conversation Button - only show on chat page */}
        {onNewConversation && (
          <NewChatButton
            onClick={onNewConversation}
            size="sm"
            variant="secondary"
            showLabel={true}
            label="Neu"
          />
        )}
      </div>

      {/* Right Section: Model Selector, Save Indicator, Theme Toggle, Connection Status */}
      <div className="flex items-center gap-4">
        {/* Model Selector - visible when Ollama is connected */}
        {showModelSelector && isOllamaConnected && onModelChange && (
          <div className="hidden sm:block">
            <ModelSelector
              value={selectedModel ?? ''}
              onChange={onModelChange}
              disabled={!isOllamaConnected}
            />
          </div>
        )}

        {/* Save Indicator */}
        {saveIndicator}

        {/* Settings Button */}
        {showSettingsButton && onSettingsClick && (
          <SettingsButton
            onClick={onSettingsClick}
            size="md"
            showLabel={true}
          />
        )}

        {/* User Menu - Show when authenticated */}
        {showUserMenu && (
          <div className="flex items-center">
            {isAuthLoading ? (
              <UserMenuSkeleton size="md" />
            ) : user && onLogout ? (
              <UserMenu
                user={user}
                onLogout={onLogout}
                showRole={true}
                size="md"
              />
            ) : null}
          </div>
        )}

        {/* Theme Toggle */}
        <ThemeToggle
          theme={theme}
          onThemeChange={onThemeChange}
          size="md"
          showLabel={true}
        />

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${connectionStatusColor}`} />
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {connectionStatusText}
          </span>
        </div>
      </div>
    </header>
  );
}

/**
 * HeaderDivider - Visual separator between header sections
 */
export function HeaderDivider() {
  const { isDark } = useTheme();
  return (
    <div
      className={`w-px h-5 ${isDark ? 'bg-white/20' : 'bg-gray-300'}`}
      role="separator"
    />
  );
}

/**
 * HeaderSection - Container for grouping header items
 */
export interface HeaderSectionProps {
  children: ReactNode;
  className?: string;
}

export function HeaderSection({ children, className = '' }: HeaderSectionProps) {
  return <div className={`flex items-center gap-3 ${className}`}>{children}</div>;
}
