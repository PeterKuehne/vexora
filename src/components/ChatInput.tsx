/**
 * ChatInput Component
 *
 * Text input with send button for chat messages.
 * Supports Enter to send, Shift+Enter for newlines.
 * Slash-commands: type "/" to see available skills.
 * @-mentions: type "@" to see available subagents.
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type FormEvent } from 'react';
import { Send, Square, Zap, Bot } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { httpClient } from '../lib/httpClient';
import { env } from '../lib/env';
import { cn } from '../utils';

interface SkillSuggestion {
  slug: string;
  name: string;
  description?: string;
}

interface AgentSuggestion {
  name: string;
  description?: string;
  source: string;
}

type DropdownMode = 'none' | 'skills' | 'agents';

export interface ChatInputProps {
  /** Called when user sends a message */
  onSend: (message: string, skillSlug?: string) => void;
  /** Called when user clicks stop */
  onStop?: () => void;
  /** Whether the AI is currently generating a response */
  isStreaming?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  placeholder = 'Nachricht eingeben...',
  disabled = false,
}: ChatInputProps) {
  const { isDark } = useTheme();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Slash-command state
  const [skills, setSkills] = useState<SkillSuggestion[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillSuggestion | null>(null);

  // @-mention state
  const [agents, setAgents] = useState<AgentSuggestion[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentSuggestion | null>(null);

  // Shared dropdown state
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>('none');
  const [filteredItems, setFilteredItems] = useState<Array<SkillSuggestion | AgentSuggestion>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load skills once
  useEffect(() => {
    httpClient.get(`${env.API_URL}/api/skills?limit=50`)
      .then(r => r.json())
      .then(data => {
        setSkills((data.skills || []).map((s: any) => ({
          slug: s.slug,
          name: s.name,
          description: s.description,
        })));
      })
      .catch(() => {});
  }, []);

  // Load agents once
  useEffect(() => {
    httpClient.get(`${env.API_URL}/api/models`)
      .then(r => r.json())
      .catch(() => {});
    // Fetch agents from a lightweight endpoint — we use the agent tool's list
    // For now, hardcode a fetch to the backend
    httpClient.get(`${env.API_URL}/api/agents/subagents`)
      .then(r => r.json())
      .then(data => {
        setAgents((data.agents || []).map((a: any) => ({
          name: a.name,
          description: a.description,
          source: a.source,
        })));
      })
      .catch(() => {
        // Endpoint might not exist yet — try to load from a simpler source
        // Fallback: the agents are discovered via the agent tool at runtime
      });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle dropdown filtering for both / and @
  useEffect(() => {
    if (selectedSkill || selectedAgent) {
      setDropdownMode('none');
      return;
    }

    // Check for @-mention (can be at start or after space)
    const atMatch = input.match(/(^|\s)@(\S*)$/);
    if (atMatch) {
      const filter = atMatch[2]!.toLowerCase();
      const matches = agents.filter(a =>
        a.name.toLowerCase().includes(filter) ||
        (a.description || '').toLowerCase().includes(filter)
      );
      if (matches.length > 0) {
        setFilteredItems(matches);
        setDropdownMode('agents');
        setSelectedIndex(0);
        return;
      }
    }

    // Check for slash-command
    if (input.startsWith('/')) {
      const filter = input.substring(1).toLowerCase();
      const matches = skills.filter(s =>
        s.slug.toLowerCase().includes(filter) ||
        s.name.toLowerCase().includes(filter)
      );
      if (matches.length > 0) {
        setFilteredItems(matches);
        setDropdownMode('skills');
        setSelectedIndex(0);
        return;
      }
    }

    setDropdownMode('none');
  }, [input, skills, agents, selectedSkill, selectedAgent]);

  const selectSkill = useCallback((skill: SkillSuggestion) => {
    setSelectedSkill(skill);
    setSelectedAgent(null);
    setInput('');
    setDropdownMode('none');
    textareaRef.current?.focus();
  }, []);

  const selectAgent = useCallback((agent: AgentSuggestion) => {
    setSelectedAgent(agent);
    setSelectedSkill(null);
    // Remove the @mention text from input
    setInput(prev => prev.replace(/(^|\s)@\S*$/, '').trim());
    setDropdownMode('none');
    textareaRef.current?.focus();
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSkill(null);
    setSelectedAgent(null);
    setInput('');
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming && !disabled) {
      let message = input.trim();

      // If an agent is selected, prepend @mention so the model delegates
      if (selectedAgent) {
        message = `@${selectedAgent.name} ${message}`;
      }

      onSend(message, selectedSkill?.slug);
      setInput('');
      setSelectedSkill(null);
      setSelectedAgent(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Dropdown navigation
    if (dropdownMode !== 'none') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          if (dropdownMode === 'skills') {
            selectSkill(item as SkillSuggestion);
          } else {
            selectAgent(item as AgentSuggestion);
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setDropdownMode('none');
        return;
      }
    }

    // Clear selection with Backspace on empty input
    if (e.key === 'Backspace' && input === '' && (selectedSkill || selectedAgent)) {
      e.preventDefault();
      clearSelection();
      return;
    }

    // Enter without Shift sends the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleStop = () => {
    onStop?.();
  };

  const showDropdown = dropdownMode !== 'none';

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Dropdown for skills or agents */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute bottom-full left-0 right-0 mb-2 rounded-xl border overflow-hidden shadow-lg z-50',
            isDark
              ? 'bg-[#1a1a1a] border-white/[0.1]'
              : 'bg-white border-gray-200'
          )}
        >
          {/* Header */}
          <div className={cn(
            'px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border-b',
            isDark ? 'text-white/30 border-white/[0.06]' : 'text-gray-400 border-gray-100'
          )}>
            {dropdownMode === 'skills' ? 'Skills' : 'Subagents'}
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filteredItems.map((item, idx) => {
              const isSkill = dropdownMode === 'skills';
              const key = isSkill ? (item as SkillSuggestion).slug : (item as AgentSuggestion).name;
              const label = isSkill ? `/${(item as SkillSuggestion).slug}` : `@${(item as AgentSuggestion).name}`;
              const Icon = isSkill ? Zap : Bot;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => isSkill ? selectSkill(item as SkillSuggestion) : selectAgent(item as AgentSuggestion)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors',
                    idx === selectedIndex
                      ? isDark ? 'bg-white/[0.08]' : 'bg-blue-50'
                      : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'
                  )}
                >
                  <Icon size={14} className={cn(
                    'shrink-0 mt-0.5',
                    idx === selectedIndex
                      ? isDark ? 'text-blue-400' : 'text-blue-600'
                      : isDark ? 'text-white/30' : 'text-gray-400'
                  )} />
                  <div className="min-w-0">
                    <div className={cn('text-sm font-medium', isDark ? 'text-white/80' : 'text-gray-800')}>
                      {label}
                    </div>
                    {item.description && (
                      <div className={cn('text-xs mt-0.5 truncate', isDark ? 'text-white/35' : 'text-gray-500')}>
                        {item.description.split('.')[0]}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={cn(
        'flex items-center gap-2 p-3 md:p-4 rounded-xl',
        'transition-colors duration-200',
        isDark
          ? 'bg-white/[0.03] border border-white/[0.08] focus-within:border-white/[0.15] focus-within:bg-white/[0.05] focus-within:ring-1 focus-within:ring-blue-500/20'
          : 'bg-white border border-gray-200/80 focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-blue-500/20 shadow-sm'
      )}>
        {/* Selected skill badge */}
        {selectedSkill && (
          <button
            type="button"
            onClick={clearSelection}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              isDark
                ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            )}
          >
            <Zap size={12} />
            {selectedSkill.name}
            <span className={cn('ml-0.5', isDark ? 'text-blue-400/50' : 'text-blue-400')}>×</span>
          </button>
        )}

        {/* Selected agent badge */}
        {selectedAgent && (
          <button
            type="button"
            onClick={clearSelection}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              isDark
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            )}
          >
            <Bot size={12} />
            @{selectedAgent.name}
            <span className={cn('ml-0.5', isDark ? 'text-emerald-400/50' : 'text-emerald-400')}>×</span>
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedSkill ? `Auftrag für ${selectedSkill.name}...` :
            selectedAgent ? `Aufgabe für @${selectedAgent.name}...` :
            placeholder
          }
          disabled={disabled || isStreaming}
          rows={1}
          className={cn(
            'flex-1 bg-transparent resize-none outline-none',
            'text-primary placeholder:text-secondary',
            'min-h-[36px] md:min-h-[24px] max-h-[200px]',
            'text-base md:text-sm',
            'touch-optimize',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-0 focus:border-0'
          )}
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark
                ? 'text-white/70 hover:bg-white/10'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className={cn(
              'p-2 rounded-lg transition-colors',
              input.trim() && !disabled
                ? isDark
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
                : isDark
                  ? 'text-white/20'
                  : 'text-gray-300'
            )}
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
