/**
 * SidebarTabs - Navigation tabs for switching between sidebar views
 *
 * Features:
 * - Tab navigation between Conversations and Documents
 * - Active tab with bottom accent indicator
 * - Icon + label design
 * - Theme-aware styling (Refined Monochrome)
 */

import { MessageCircle, Brain } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export type SidebarTab = 'conversations' | 'rag';

interface SidebarTabsProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  const { isDark } = useTheme();

  const tabs: Array<{ id: SidebarTab; label: string; icon: typeof MessageCircle }> = [
    { id: 'conversations', label: 'Chat', icon: MessageCircle },
    { id: 'rag', label: 'RAG', icon: Brain },
  ];

  return (
    <div
      className={`
        flex p-1 rounded-xl
        ${isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-gray-100 border border-gray-200/60'}
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
              relative flex-1 flex items-center justify-center gap-2
              px-3 py-2 rounded-lg text-[13px] font-semibold
              transition-all duration-200
              ${
                isActive
                  ? isDark
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDark
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }
            `}
          >
            <Icon size={15} />
            <span>{tab.label}</span>
            {/* Active dot indicator */}
            {isActive && (
              <div className={`
                absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full
                ${isDark ? 'bg-blue-400' : 'bg-blue-500'}
              `} />
            )}
          </button>
        );
      })}
    </div>
  );
}
