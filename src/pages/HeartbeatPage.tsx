/**
 * HeartbeatPage — Admin page for managing proactive background checks
 *
 * Shows all heartbeat definitions as a list with status, cron, last run.
 * Admins can create, edit, toggle, delete, and manually run heartbeats.
 */

import { useState, useEffect, useCallback } from 'react';
import { Activity, Plus, Play, Trash2, Clock, ArrowLeft, Save, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../utils';
import {
  fetchHeartbeatDefinitions,
  createHeartbeatDefinition,
  updateHeartbeatDefinition,
  toggleHeartbeatDefinition,
  deleteHeartbeatDefinition,
  runHeartbeat,
  type HeartbeatDefinition,
  type HeartbeatInput,
} from '../lib/heartbeat-api';

export function HeartbeatPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'Admin';

  const [definitions, setDefinitions] = useState<HeartbeatDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadDefinitions = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchHeartbeatDefinitions();
      setDefinitions(data);
    } catch (err) {
      toast.error('Fehler beim Laden der Heartbeats');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadDefinitions(); }, [loadDefinitions]);

  const handleToggle = async (id: string) => {
    try {
      const updated = await toggleHeartbeatDefinition(id);
      toast.success(`"${updated.name}" ${updated.enabled ? 'aktiviert' : 'deaktiviert'}`);
      loadDefinitions();
    } catch { toast.error('Fehler beim Umschalten'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" wirklich loeschen?`)) return;
    try {
      await deleteHeartbeatDefinition(id);
      toast.success(`"${name}" geloescht`);
      loadDefinitions();
    } catch { toast.error('Fehler beim Loeschen'); }
  };

  const handleRun = async (id: string, name: string) => {
    try {
      const result = await runHeartbeat(id);
      toast.success(`"${name}" ausgefuehrt — ${result.hasResult ? 'Ergebnis gespeichert' : 'Kein Ergebnis (unter Threshold)'}`);
      loadDefinitions();
    } catch { toast.error('Fehler beim Ausfuehren'); }
  };

  const handleSave = async (data: HeartbeatInput, id?: string) => {
    try {
      if (id) {
        await updateHeartbeatDefinition(id, data);
        toast.success(`"${data.name}" gespeichert`);
      } else {
        await createHeartbeatDefinition(data);
        toast.success(`"${data.name}" erstellt`);
      }
      setEditingId(null);
      setIsCreating(false);
      loadDefinitions();
    } catch (err) {
      toast.error((err as Error).message || 'Fehler beim Speichern');
    }
  };

  // ─── Edit Form ─────────────────────────────
  if (isCreating || editingId) {
    const editing = editingId ? definitions.find(d => d.id === editingId) : null;
    return (
      <HeartbeatForm
        definition={editing}
        onSave={(data) => handleSave(data, editingId || undefined)}
        onCancel={() => { setEditingId(null); setIsCreating(false); }}
      />
    );
  }

  // ─── List View ─────────────────────────────
  return (
    <div className={cn('min-h-screen', isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50')}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className={cn('text-3xl font-bold tracking-tight flex items-center gap-3', isDark ? 'text-white' : 'text-gray-900')}>
              <Activity size={28} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
              Heartbeat Engine
            </h1>
            <p className={cn('mt-2 text-sm', isDark ? 'text-white/40' : 'text-gray-500')}>
              Proaktive Hintergrund-Checks — der Hive Mind beobachtet und informiert.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsCreating(true)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all',
                isDark ? 'bg-white text-black hover:bg-white/90' : 'bg-gray-900 text-white hover:bg-gray-800'
              )}
            >
              <Plus size={16} />
              Neuer Heartbeat
            </button>
          )}
        </div>

        {/* Definitions List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn('h-20 rounded-xl animate-pulse', isDark ? 'bg-white/[0.03]' : 'bg-gray-200')} />
            ))}
          </div>
        ) : definitions.length === 0 ? (
          <div className={cn('text-center py-16', isDark ? 'text-white/30' : 'text-gray-400')}>
            <Activity size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Keine Heartbeats konfiguriert.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {definitions.map(def => (
              <div
                key={def.id}
                className={cn(
                  'rounded-xl border p-4 transition-all',
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                    : 'bg-white border-gray-200 hover:shadow-sm'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Icon + Status */}
                    <span className="text-xl shrink-0">{def.icon}</span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-gray-900')}>
                          {def.name}
                        </h3>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                          def.enabled
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        )}>
                          {def.enabled ? 'Aktiv' : 'Inaktiv'}
                        </span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-medium uppercase',
                          def.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
                          def.priority === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                          isDark ? 'bg-white/[0.05] text-white/40' : 'bg-gray-100 text-gray-500'
                        )}>
                          {def.priority}
                        </span>
                        {def.source === 'builtin' && (
                          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-medium uppercase', isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')}>
                            Built-in
                          </span>
                        )}
                      </div>
                      <p className={cn('text-xs mt-0.5 truncate', isDark ? 'text-white/30' : 'text-gray-500')}>
                        {def.description || 'Keine Beschreibung'}
                      </p>
                    </div>
                  </div>

                  {/* Meta + Actions */}
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    {/* Cron */}
                    <div className={cn('flex items-center gap-1.5 text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
                      <Clock size={12} />
                      <span className="font-mono">{def.cron}</span>
                    </div>

                    {/* Last Run */}
                    {def.lastRunAt && (
                      <span className={cn('text-[10px]', isDark ? 'text-white/20' : 'text-gray-400')}>
                        {new Date(def.lastRunAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    )}

                    {/* Actions (Admin only) */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRun(def.id, def.name)}
                          title="Jetzt ausfuehren"
                          className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50')}
                        >
                          <Play size={14} />
                        </button>
                        <button
                          onClick={() => handleToggle(def.id)}
                          title={def.enabled ? 'Deaktivieren' : 'Aktivieren'}
                          className={cn('p-1.5 rounded-lg transition-colors text-xs font-medium', isDark ? 'text-white/30 hover:text-white/60 hover:bg-white/[0.05]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
                        >
                          {def.enabled ? 'Off' : 'On'}
                        </button>
                        <button
                          onClick={() => setEditingId(def.id)}
                          title="Bearbeiten"
                          className={cn('p-1.5 rounded-lg transition-colors text-xs font-medium', isDark ? 'text-white/30 hover:text-white/60 hover:bg-white/[0.05]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
                        >
                          Edit
                        </button>
                        {def.source !== 'builtin' && (
                          <button
                            onClick={() => handleDelete(def.id, def.name)}
                            title="Loeschen"
                            className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-white/20 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:text-red-600 hover:bg-red-50')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Heartbeat Edit/Create Form ──────────────

function HeartbeatForm({
  definition,
  onSave,
  onCancel,
}: {
  definition: HeartbeatDefinition | null;
  onSave: (data: HeartbeatInput) => void;
  onCancel: () => void;
}) {
  const { isDark } = useTheme();

  const [name, setName] = useState(definition?.name || '');
  const [description, setDescription] = useState(definition?.description || '');
  const [cronExpr, setCronExpr] = useState(definition?.cron || '0 7 * * 1-5');
  const [icon, setIcon] = useState(definition?.icon || '📋');
  const [priority, setPriority] = useState(definition?.priority || 'info');
  const [toolName, setToolName] = useState((definition?.config as any)?.tool || '');
  const [toolArgs, setToolArgs] = useState(JSON.stringify((definition?.config as any)?.args || {}, null, 2));
  const [selections, setSelections] = useState((definition?.config as any)?.selections || '');
  const [thresholdField, setThresholdField] = useState((definition?.config as any)?.threshold?.field || 'length');
  const [thresholdOp, setThresholdOp] = useState((definition?.config as any)?.threshold?.operator || 'gt');
  const [thresholdValue, setThresholdValue] = useState((definition?.config as any)?.threshold?.value ?? 0);

  const inputClass = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors',
    isDark
      ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 focus:border-blue-500/40'
      : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500'
  );

  const handleSubmit = () => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(toolArgs); } catch { /* ignore */ }

    onSave({
      name,
      description: description || undefined,
      cron: cronExpr,
      icon,
      priority: priority as any,
      config: {
        tool: toolName,
        args: Object.keys(args).length > 0 ? args : undefined,
        selections: selections || undefined,
        threshold: thresholdField ? { field: thresholdField, operator: thresholdOp, value: thresholdValue } : undefined,
      },
    });
  };

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50')}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b',
        isDark ? 'bg-[#0a0a0b]/95 backdrop-blur border-white/[0.06]' : 'bg-white/95 backdrop-blur border-gray-200'
      )}>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className={cn('flex items-center gap-1.5 text-sm', isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-900')}>
            <ArrowLeft size={16} /> Zurueck
          </button>
          <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            {definition ? definition.name : 'Neuer Heartbeat'}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name || !cronExpr || !toolName}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={12} className="inline mr-1.5" />
          Speichern
        </button>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Basics */}
        <div className={cn('rounded-xl border p-5', isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200')}>
          <h3 className={cn('text-xs font-bold uppercase tracking-wider mb-4', isDark ? 'text-blue-400' : 'text-blue-600')}>Basis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="AUeG-Fristen" className={inputClass} />
            </div>
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Cron-Expression</label>
              <input value={cronExpr} onChange={e => setCronExpr(e.target.value)} placeholder="0 7 * * 1-5" className={cn(inputClass, 'font-mono')} />
              <p className={cn('mt-1 text-[10px]', isDark ? 'text-white/20' : 'text-gray-400')}>z.B. "0 7 * * 1-5" = Mo-Fr 07:00</p>
            </div>
          </div>
          <div className="mt-3">
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Beschreibung</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Was prueft dieser Heartbeat?" className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Icon</label>
              <input value={icon} onChange={e => setIcon(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Prioritaet</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={inputClass}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Query */}
        <div className={cn('rounded-xl border p-5', isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200')}>
          <h3 className={cn('text-xs font-bold uppercase tracking-wider mb-4', isDark ? 'text-blue-400' : 'text-blue-600')}>MCP Tool Query</h3>
          <div>
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Tool Name</label>
            <input value={toolName} onChange={e => setToolName(e.target.value)} placeholder="sama_assignmentsNearLimit" className={cn(inputClass, 'font-mono')} />
          </div>
          <div className="mt-3">
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Args (JSON)</label>
            <textarea value={toolArgs} onChange={e => setToolArgs(e.target.value)} rows={3} className={cn(inputClass, 'font-mono resize-none')} />
          </div>
          <div className="mt-3">
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>GraphQL Selections</label>
            <input value={selections} onChange={e => setSelections(e.target.value)} placeholder="{ id name status }" className={cn(inputClass, 'font-mono')} />
          </div>
        </div>

        {/* Threshold */}
        <div className={cn('rounded-xl border p-5', isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200')}>
          <h3 className={cn('text-xs font-bold uppercase tracking-wider mb-4', isDark ? 'text-blue-400' : 'text-blue-600')}>Threshold (wann ist das Ergebnis relevant?)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Feld</label>
              <input value={thresholdField} onChange={e => setThresholdField(e.target.value)} placeholder="length" className={inputClass} />
            </div>
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Operator</label>
              <select value={thresholdOp} onChange={e => setThresholdOp(e.target.value)} className={inputClass}>
                <option value="gt">&gt; (groesser)</option>
                <option value="gte">&gt;= (groesser gleich)</option>
                <option value="lt">&lt; (kleiner)</option>
                <option value="lte">&lt;= (kleiner gleich)</option>
                <option value="eq">= (gleich)</option>
                <option value="ne">!= (ungleich)</option>
              </select>
            </div>
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider mb-1.5', isDark ? 'text-white/40' : 'text-gray-500')}>Wert</label>
              <input type="number" value={thresholdValue} onChange={e => setThresholdValue(Number(e.target.value))} className={inputClass} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
