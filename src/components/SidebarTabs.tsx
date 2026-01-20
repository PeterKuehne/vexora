/**
 * SidebarTabs - Navigation tabs for switching between sidebar views
 *
 * Features:
 * - Tab navigation between Conversations and Documents
 * - Active tab highlighting
 * - Icon + label design
 * - Theme-aware styling
 */

import { MessageCircle, File } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export type SidebarTab = 'conversations' | 'documents';

interface SidebarTabsProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  const { isDark } = useTheme();

  const tabs: Array<{ id: SidebarTab; label: string; icon: typeof MessageCircle }> = [
    { id: 'conversations', label: 'Chat', icon: MessageCircle },
    { id: 'documents', label: 'Dokumente', icon: File },
  ];

  return (
    <div
      className={`
        flex p-1 rounded-lg
        ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}
      `}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2
              px-3 py-2 rounded-md text-sm font-medium
              transition-all duration-150
              ${
                isActive
                  ? isDark
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }
            `}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}