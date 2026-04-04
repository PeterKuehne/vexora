/**
 * ExpertAgentsPage — Overview + Detail for Expert Agent management
 *
 * Design: Cards grid with character avatars (Screenshot 2)
 * All users see agents (read-only). Admins can create/edit/delete.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../utils';
import { ExpertAgentCard } from '../components/ExpertAgentCard';
import { ExpertAgentDetail } from '../components/ExpertAgentDetail';
import {
  fetchExpertAgents,
  createExpertAgent,
  updateExpertAgent,
  deleteExpertAgent,
  toggleExpertAgent,
  type ExpertAgentRecord,
  type ExpertAgentInput,
} from '../lib/expert-agents-api';

type ViewMode = 'grid' | 'detail' | 'create';

export function ExpertAgentsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'Admin';

  const [agents, setAgents] = useState<ExpertAgentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedAgent, setSelectedAgent] = useState<ExpertAgentRecord | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchExpertAgents();
      setAgents(data);
    } catch (err) {
      toast.error((err as Error).message || 'Fehler beim Laden der Expert Agents');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCardClick = (agent: ExpertAgentRecord) => {
    setSelectedAgent(agent);
    setViewMode('detail');
  };

  const handleCreate = () => {
    setSelectedAgent(null);
    setViewMode('create');
  };

  const handleBack = () => {
    setSelectedAgent(null);
    setViewMode('grid');
  };

  const handleSave = async (data: ExpertAgentInput) => {
    try {
      if (selectedAgent) {
        await updateExpertAgent(selectedAgent.id, data);
        toast.success(`"${data.name}" wurde gespeichert`);
      } else {
        await createExpertAgent(data);
        toast.success(`"${data.name}" wurde erstellt`);
      }
      await loadAgents();
      setViewMode('grid');
      setSelectedAgent(null);
    } catch (err) {
      toast.error((err as Error).message || 'Fehler beim Speichern');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpertAgent(id);
      toast.success('Expert Agent geloescht');
      await loadAgents();
      setViewMode('grid');
      setSelectedAgent(null);
    } catch (err) {
      toast.error((err as Error).message || 'Fehler beim Loeschen');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const updated = await toggleExpertAgent(id);
      toast.success(`"${updated.name}" ${updated.isActive ? 'aktiviert' : 'deaktiviert'}`);
      await loadAgents();
      if (selectedAgent?.id === id) {
        setSelectedAgent(updated);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Fehler beim Umschalten');
    }
  };

  // ─── Detail / Create View ──────────────────────
  if (viewMode === 'detail' || viewMode === 'create') {
    return (
      <ExpertAgentDetail
        agent={selectedAgent}
        isAdmin={isAdmin}
        onBack={handleBack}
        onSave={handleSave}
        onDelete={selectedAgent ? () => handleDelete(selectedAgent.id) : undefined}
        onToggle={selectedAgent ? () => handleToggle(selectedAgent.id) : undefined}
      />
    );
  }

  // ─── Grid View (Cards) ─────────────────────────
  return (
    <div className={cn(
      'min-h-screen',
      isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'
    )}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className={cn(
              'text-3xl font-bold tracking-tight',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Spezialisierte Experten
            </h1>
            <p className={cn(
              'mt-2 text-sm',
              isDark ? 'text-white/40' : 'text-gray-500'
            )}>
              Die inneren Organe des Hive Mind — domain-spezifische Expert Agents
              fuer praezise Ergebnisse.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleCreate}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm',
                'transition-all duration-150',
                isDark
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              )}
            >
              <Plus size={16} />
              Agenten Erstellen
            </button>
          )}
        </div>

        {/* Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn(
                'h-[420px] rounded-2xl animate-pulse',
                isDark ? 'bg-white/[0.03]' : 'bg-gray-200'
              )} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {agents.map(agent => (
              <ExpertAgentCard
                key={agent.id}
                agent={agent}
                onClick={() => handleCardClick(agent)}
              />
            ))}

            {/* "+ Neuer Experte" Placeholder Card (Admin only) */}
            {isAdmin && (
              <button
                onClick={handleCreate}
                className={cn(
                  'h-[420px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3',
                  'transition-all duration-200',
                  isDark
                    ? 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/50 hover:bg-white/[0.02]'
                    : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-50'
                )}
              >
                <div className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center',
                  isDark ? 'bg-white/[0.05]' : 'bg-gray-100'
                )}>
                  <Plus size={24} />
                </div>
                <span className="text-sm font-medium uppercase tracking-wider">Neuer Experte</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
