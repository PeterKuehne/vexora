/**
 * ExpertAgentDetail — Create/Edit/View form for Expert Agents
 *
 * Design based on Screenshot 1:
 * - Two-column layout: Left (config) + Right (tools + system prompt)
 * - Header with Back/Delete/Deactivate/Save buttons
 * - Markdown editor with line numbers and Bearbeiten/Vorschau toggle
 * - Tool selector grouped by category
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Trash2, Save, Bot, Info, Cpu, Shield, Grid3X3, FileText, X, Plus, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils';
import { fetchAvailableTools, type ExpertAgentRecord, type ExpertAgentInput, type ToolInfo } from '../lib/expert-agents-api';

interface ExpertAgentDetailProps {
  agent: ExpertAgentRecord | null; // null = create mode
  isAdmin: boolean;
  onBack: () => void;
  onSave: (data: ExpertAgentInput) => Promise<void>;
  onDelete?: () => void;
  onToggle?: () => void;
}

export function ExpertAgentDetail({ agent, isAdmin, onBack, onSave, onDelete, onToggle }: ExpertAgentDetailProps) {
  const { isDark } = useTheme();
  const isCreateMode = !agent;
  const isReadOnly = !isAdmin;

  // Form state
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [isActive, setIsActive] = useState(agent?.isActive ?? true);
  const [model, setModel] = useState(agent?.model || 'gpt-oss-120b');
  const [maxSteps, setMaxSteps] = useState(agent?.maxSteps || 15);
  const [roles, setRoles] = useState<string[]>(agent?.roles || []);
  const [rules, setRules] = useState<string[]>(agent?.rules || []);
  const [selectedTools, setSelectedTools] = useState<string[]>(agent?.tools || []);
  const [instructions, setInstructions] = useState(agent?.instructions || '');

  // UI state
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
  const [toolSearch, setToolSearch] = useState('');
  const [promptMode, setPromptMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [newRule, setNewRule] = useState('');

  useEffect(() => {
    fetchAvailableTools().then(setAvailableTools).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!name || !description || !instructions) return;
    setIsSaving(true);
    try {
      await onSave({ name, description, model, maxSteps, roles, rules, tools: selectedTools, instructions });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const toggleTool = (toolName: string) => {
    setSelectedTools(prev => prev.includes(toolName) ? prev.filter(t => t !== toolName) : [...prev, toolName]);
  };

  const addRule = () => {
    if (newRule.trim()) {
      setRules(prev => [...prev, newRule.trim()]);
      setNewRule('');
    }
  };

  const removeRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  // Group tools by category
  const toolsByCategory = availableTools.reduce((acc, tool) => {
    if (toolSearch && !tool.name.toLowerCase().includes(toolSearch.toLowerCase()) && !tool.description.toLowerCase().includes(toolSearch.toLowerCase())) {
      return acc;
    }
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolInfo[]>);

  const allRoles = ['Admin', 'Manager', 'Employee'];

  // ─── Section Card wrapper ──────────────────
  const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className={cn(
      'rounded-xl border p-5',
      isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200'
    )}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
        <h3 className={cn('text-xs font-bold uppercase tracking-wider', isDark ? 'text-blue-400' : 'text-blue-600')}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );

  // ─── Label helper ──────────────────────────
  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>
      {children}
    </label>
  );

  // ─── Input helper ──────────────────────────
  const inputClass = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors',
    isDark
      ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 focus:border-blue-500/40'
      : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500',
    isReadOnly && 'opacity-70 cursor-not-allowed'
  );

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50')}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b',
        isDark ? 'bg-[#0a0a0b]/95 backdrop-blur border-white/[0.06]' : 'bg-white/95 backdrop-blur border-gray-200'
      )}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={cn('flex items-center gap-1.5 text-sm', isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-900')}>
            <ArrowLeft size={16} />
            Zurueck
          </button>
          <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            {isCreateMode ? 'Neuer Expert Agent' : agent.name}
          </span>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {onDelete && !isCreateMode && agent.source !== 'builtin' && (
              <button onClick={onDelete} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors">
                Loeschen
              </button>
            )}
            {onToggle && !isCreateMode && (
              <button onClick={onToggle} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', isDark ? 'text-white/60 border-white/[0.08] hover:bg-white/[0.05]' : 'text-gray-600 border-gray-200 hover:bg-gray-100')}>
                {agent.isActive ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || !name || !description || !instructions}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        )}
      </div>

      {/* Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 52px)' }}>
        {/* Left Column: Config */}
        <div className="space-y-5">
          {/* Basis Informationen */}
          <Section icon={Info} title="Basis Informationen">
            <div className="flex items-start gap-4">
              {/* Avatar Placeholder */}
              <div className={cn(
                'w-20 h-20 rounded-xl flex items-center justify-center shrink-0',
                isDark ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-gray-100 border border-gray-200'
              )}>
                {agent?.avatarUrl ? (
                  <img src={agent.avatarUrl} alt={name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Bot size={32} className={isDark ? 'text-white/20' : 'text-gray-400'} />
                )}
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="hr-expert" disabled={isReadOnly} className={inputClass} />
                </div>
                <div>
                  <Label>Status</Label>
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                    isDark ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-gray-50 border border-gray-200'
                  )}>
                    <span className={cn('w-2 h-2 rounded-full', isActive ? 'bg-emerald-400' : 'bg-red-400')} />
                    <span className={isDark ? 'text-white/80' : 'text-gray-700'}>{isActive ? 'Aktiv' : 'Inaktiv'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <Label>Beschreibung</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                disabled={isReadOnly}
                placeholder="Wann soll der Hive Mind diesen Agent aufrufen?"
                className={cn(inputClass, 'resize-none')}
              />
            </div>
          </Section>

          {/* Modell & Limits */}
          <Section icon={Cpu} title="Modell & Limits">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Modell Auswahl</Label>
                <select value={model} onChange={e => setModel(e.target.value)} disabled={isReadOnly} className={inputClass}>
                  <option value="gpt-oss-120b">gpt-oss-120b</option>
                </select>
                <p className={cn('mt-1 text-[10px]', isDark ? 'text-white/20' : 'text-gray-400')}>
                  Optimiert fuer komplexe Aufgaben.
                </p>
              </div>
              <div>
                <Label>Max. Schritte</Label>
                <input type="number" value={maxSteps} onChange={e => setMaxSteps(Number(e.target.value))} min={1} max={50} disabled={isReadOnly} className={inputClass} />
                <p className={cn('mt-1 text-[10px]', isDark ? 'text-white/20' : 'text-gray-400')}>
                  Begrenzt die Tiefe rekursiver Tool-Aufrufe.
                </p>
              </div>
            </div>
          </Section>

          {/* Zugriff (Guardrails) */}
          <Section icon={Shield} title="Zugriff (Guardrails)">
            {/* Roles */}
            <Label>Rollen</Label>
            <div className="flex items-center gap-3 mb-4">
              {allRoles.map(role => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => !isReadOnly && toggleRole(role)}
                    disabled={isReadOnly}
                    className="w-4 h-4 rounded border-white/20 text-blue-500 focus:ring-blue-500 bg-transparent"
                  />
                  <span className={cn('text-sm', isDark ? 'text-white/70' : 'text-gray-700')}>{role}</span>
                </label>
              ))}
            </div>

            {/* Rules */}
            <Label>Constraint Regeln</Label>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-gray-50 border border-gray-200'
                )}>
                  <span className={cn('flex-1 text-sm', isDark ? 'text-white/70' : 'text-gray-700')}>{rule}</span>
                  {!isReadOnly && (
                    <button onClick={() => removeRule(i)} className={cn('shrink-0', isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <input
                    value={newRule}
                    onChange={e => setNewRule(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRule()}
                    placeholder="Neue Regel hinzufuegen..."
                    className={cn(inputClass, 'flex-1')}
                  />
                  <button onClick={addRule} disabled={!newRule.trim()} className={cn('shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors', isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/[0.05]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')}>
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Right Column: Tools + System Prompt */}
        <div className="space-y-5">
          {/* Tools */}
          <Section icon={Grid3X3} title="Tools">
            <div className="flex items-center justify-between mb-3">
              <span className={cn('text-xs', isDark ? 'text-white/40' : 'text-gray-500')}>
                {selectedTools.length} von {availableTools.length} ausgewaehlt
              </span>
            </div>

            {/* Search */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg mb-3',
              isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-gray-50 border border-gray-200'
            )}>
              <Search size={14} className={isDark ? 'text-white/30' : 'text-gray-400'} />
              <input
                value={toolSearch}
                onChange={e => setToolSearch(e.target.value)}
                placeholder="Suche..."
                className={cn('flex-1 bg-transparent text-sm outline-none', isDark ? 'text-white placeholder:text-white/20' : 'text-gray-900 placeholder:text-gray-400')}
              />
            </div>

            {/* Grouped Tools */}
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
              {Object.entries(toolsByCategory).map(([category, tools]) => (
                <div key={category}>
                  <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/30' : 'text-gray-400')}>
                    {category}
                  </p>
                  <div className="space-y-0.5">
                    {tools.map(tool => (
                      <label key={tool.name} className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                        isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50',
                        isReadOnly && 'cursor-default'
                      )}>
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(tool.name)}
                          onChange={() => !isReadOnly && toggleTool(tool.name)}
                          disabled={isReadOnly}
                          className="w-4 h-4 rounded border-white/20 text-blue-500 focus:ring-blue-500 bg-transparent"
                        />
                        <span className={cn('text-sm', isDark ? 'text-white/80' : 'text-gray-700')}>{tool.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* System Prompt */}
          <Section icon={FileText} title="System Prompt">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 mb-3">
              <button
                onClick={() => setPromptMode('edit')}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  promptMode === 'edit'
                    ? isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-200 text-gray-900'
                    : isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Bearbeiten
              </button>
              <button
                onClick={() => setPromptMode('preview')}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  promptMode === 'preview'
                    ? isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-200 text-gray-900'
                    : isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Vorschau
              </button>
            </div>

            {promptMode === 'edit' ? (
              <div className="relative">
                {/* Line numbers + textarea */}
                <div className={cn(
                  'flex rounded-lg overflow-hidden border font-mono text-xs',
                  isDark ? 'bg-[#0d0d0e] border-white/[0.06]' : 'bg-gray-50 border-gray-200'
                )}>
                  {/* Line numbers */}
                  <div className={cn(
                    'select-none text-right pr-3 pl-2 pt-3 pb-3 leading-5',
                    isDark ? 'text-white/15 bg-white/[0.02]' : 'text-gray-300 bg-gray-100'
                  )}>
                    {instructions.split('\n').map((_, i) => (
                      <div key={i}>{String(i + 1).padStart(2, '0')}</div>
                    ))}
                    {!instructions && <div>01</div>}
                  </div>
                  {/* Editor */}
                  <textarea
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="Du bist der [Domain]-Experte im Hive Mind..."
                    rows={Math.max(20, instructions.split('\n').length + 2)}
                    className={cn(
                      'flex-1 resize-none outline-none pt-3 pb-3 pr-3 leading-5',
                      isDark ? 'bg-transparent text-white/80 placeholder:text-white/15' : 'bg-transparent text-gray-800 placeholder:text-gray-400',
                      isReadOnly && 'cursor-not-allowed'
                    )}
                    spellCheck={false}
                  />
                </div>
              </div>
            ) : (
              <div className={cn(
                'rounded-lg border p-4 prose prose-sm max-w-none',
                isDark
                  ? 'bg-[#0d0d0e] border-white/[0.06] prose-invert prose-p:text-white/70 prose-headings:text-white/90 prose-li:text-white/70'
                  : 'bg-gray-50 border-gray-200'
              )}>
                {/* Simple markdown rendering — headings and lists */}
                {instructions.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h2 key={i} className="text-sm font-bold mt-3 mb-1">{line.slice(3)}</h2>;
                  if (line.startsWith('# ')) return <h1 key={i} className="text-base font-bold mt-3 mb-1">{line.slice(2)}</h1>;
                  if (line.startsWith('- ')) return <li key={i} className="text-xs ml-4">{line.slice(2)}</li>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="text-xs">{line}</p>;
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
