/**
 * IconRail - Vertical icon navigation (48px wide)
 *
 * Inspired by Claude Cowork's task-centric approach.
 * Phase 1: Chat + Documents active. Tasks/Skills/Knowledge as disabled placeholders.
 */

import {
  MessageSquare,
  Bot,
  Zap,
  FileText,
  Link2,
  Settings,
  User,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../../contexts';

export type WorkspaceSection = 'chat' | 'tasks' | 'skills' | 'documents' | 'knowledge';

interface IconRailProps {
  activeSection: WorkspaceSection;
  onSectionChange: (section: WorkspaceSection) => void;
  onSettingsClick: () => void;
  userName?: string;
  onLogout?: () => void;
}

interface NavItem {
  id: WorkspaceSection;
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'tasks', icon: Bot, label: 'Tasks' },
  { id: 'skills', icon: Zap, label: 'Skills', disabled: true, tooltip: 'Kommt bald' },
  { id: 'documents', icon: FileText, label: 'Dokumente' },
  { id: 'knowledge', icon: Link2, label: 'Wissen', disabled: true, tooltip: 'Kommt bald' },
];

export function IconRail({
  activeSection,
  onSectionChange,
  onSettingsClick,
  userName,
  onLogout,
}: IconRailProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={`
        w-12 shrink-0 flex flex-col items-center py-2
        border-r
        ${isDark ? 'bg-[#0a0a0b] border-white/[0.06]' : 'bg-gray-50 border-gray-200'}
      `}
    >
      {/* Workspace Navigation */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && onSectionChange(item.id)}
              disabled={item.disabled}
              title={item.disabled ? item.tooltip : item.label}
              className={`
                relative w-9 h-9 flex items-center justify-center rounded-lg
                transition-all duration-150
                ${item.disabled
                  ? isDark
                    ? 'text-white/20 cursor-not-allowed'
                    : 'text-gray-300 cursor-not-allowed'
                  : isActive
                    ? isDark
                      ? 'text-white bg-white/[0.08]'
                      : 'text-gray-900 bg-gray-200'
                    : isDark
                      ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              {/* Active indicator */}
              {isActive && (
                <span
                  className={`
                    absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r
                    ${isDark ? 'bg-white' : 'bg-gray-900'}
                  `}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* System Section */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        {/* Divider */}
        <div className={`w-6 h-px my-1 ${isDark ? 'bg-white/[0.06]' : 'bg-gray-200'}`} />

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          title="Einstellungen"
          className={`
            w-9 h-9 flex items-center justify-center rounded-lg
            transition-colors duration-150
            ${isDark
              ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>

        {/* User */}
        <div className="relative group">
          <button
            title={userName || 'Profil'}
            className={`
              w-9 h-9 flex items-center justify-center rounded-lg
              transition-colors duration-150
              ${isDark
                ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <User size={18} strokeWidth={1.5} />
          </button>

          {/* Dropdown */}
          {onLogout && (
            <div
              className={`
                absolute bottom-0 left-full ml-1 hidden group-hover:block
                rounded-lg shadow-lg border py-1 min-w-[140px] z-50
                ${isDark
                  ? 'bg-[#1a1a1b] border-white/10'
                  : 'bg-white border-gray-200'
                }
              `}
            >
              {userName && (
                <div className={`px-3 py-1.5 text-xs truncate ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                  {userName}
                </div>
              )}
              <button
                onClick={onLogout}
                className={`
                  w-full flex items-center gap-2 px-3 py-1.5 text-sm
                  ${isDark
                    ? 'text-white/70 hover:bg-white/[0.05]'
                    : 'text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                <LogOut size={14} />
                Abmelden
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
