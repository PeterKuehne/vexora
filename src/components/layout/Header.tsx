/**
 * Header Component - Main Application Header
 * Displays logo/title on the left and controls (theme toggle, status) on the right
 * Fixed positioning at the top of the viewport
 */

import { type ReactNode } from 'react';
import { Menu, Plus, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts';
import type { Theme } from '../../types/settings';

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
}

/**
 * Get theme icon and label for display
 */
function getThemeInfo(theme: Theme) {
  switch (theme) {
    case 'light':
      return { Icon: Sun, label: 'Hell' };
    case 'system':
      return { Icon: Monitor, label: 'System' };
    case 'dark':
    default:
      return { Icon: Moon, label: 'Dunkel' };
  }
}

/**
 * Cycle through themes: dark -> light -> system -> dark
 */
function getNextTheme(currentTheme: Theme): Theme {
  const themeOrder: Theme[] = ['dark', 'light', 'system'];
  const currentIndex = themeOrder.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themeOrder.length;
  return themeOrder[nextIndex];
}

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
}: HeaderProps) {
  const { isDark } = useTheme();
  const themeInfo = getThemeInfo(theme);

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

  const handleThemeToggle = () => {
    onThemeChange(getNextTheme(theme));
  };

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
              p-1.5 rounded-lg transition-colors
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
        <h1
          className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          Qwen Chat
        </h1>

        {/* New Conversation Button */}
        {onNewConversation && (
          <button
            onClick={onNewConversation}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isDark
                ? 'text-gray-300 hover:text-white hover:bg-white/10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
            }`}
            title="Neue Unterhaltung"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neu</span>
          </button>
        )}
      </div>

      {/* Right Section: Save Indicator, Theme Toggle, Connection Status */}
      <div className="flex items-center gap-4">
        {/* Save Indicator */}
        {saveIndicator}

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          className={`flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-lg transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-white hover:bg-white/10'
              : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'
          }`}
          title={`Theme: ${themeInfo.label}`}
        >
          <themeInfo.Icon size={16} />
          <span className="hidden sm:inline">{themeInfo.label}</span>
        </button>

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
