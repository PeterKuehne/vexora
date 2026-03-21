/**
 * PermissionPreview - Shows effective document permissions
 *
 * Features:
 * - Clear visualization of who can access the document
 * - Classification level impact explanation
 * - TailwindCSS styling with theme support (MANDATORY)
 * - Refined layered card design with accent indicators
 * - Classification color-coded header badge
 */

import { Shield, Users, Eye, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { ClassificationLevel } from './ClassificationDropdown';
import type { VisibilityType } from './VisibilitySelector';

interface PermissionPreviewProps {
  classification: ClassificationLevel;
  visibility: VisibilityType;
  specificUsers: string[];
  department?: string;
}

interface PermissionRule {
  icon: typeof Eye;
  title: string;
  description: string;
  type: 'allowed' | 'restricted' | 'info';
}

const CLASSIFICATION_LABELS: Record<ClassificationLevel, string> = {
  public: 'Öffentlich',
  internal: 'Intern',
  confidential: 'Vertraulich',
  restricted: 'Eingeschränkt'
};

const VISIBILITY_LABELS: Record<VisibilityType, string> = {
  only_me: 'Nur ich',
  department: 'Abteilung',
  all_users: 'Alle Benutzer',
  specific_users: 'Bestimmte Benutzer'
};

const CLASSIFICATION_COLORS: Record<ClassificationLevel, {
  badge: { dark: string; light: string };
  icon: { dark: string; light: string };
  accent: { dark: string; light: string };
}> = {
  public: {
    badge: { dark: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', light: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60' },
    icon: { dark: 'text-emerald-400', light: 'text-emerald-600' },
    accent: { dark: 'bg-emerald-500', light: 'bg-emerald-500' }
  },
  internal: {
    badge: { dark: 'bg-blue-500/10 text-blue-400 ring-blue-500/20', light: 'bg-blue-50 text-blue-700 ring-blue-200/60' },
    icon: { dark: 'text-blue-400', light: 'text-blue-600' },
    accent: { dark: 'bg-blue-500', light: 'bg-blue-500' }
  },
  confidential: {
    badge: { dark: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', light: 'bg-amber-50 text-amber-700 ring-amber-200/60' },
    icon: { dark: 'text-amber-400', light: 'text-amber-600' },
    accent: { dark: 'bg-amber-500', light: 'bg-amber-500' }
  },
  restricted: {
    badge: { dark: 'bg-red-500/10 text-red-400 ring-red-500/20', light: 'bg-red-50 text-red-700 ring-red-200/60' },
    icon: { dark: 'text-red-400', light: 'text-red-600' },
    accent: { dark: 'bg-red-500', light: 'bg-red-500' }
  }
};

export function PermissionPreview({
  classification,
  visibility,
  specificUsers,
  department
}: PermissionPreviewProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const userDepartment = department || user?.department || 'Unbekannt';
  const colors = CLASSIFICATION_COLORS[classification];

  // Generate permission rules based on settings
  const getPermissionRules = (): PermissionRule[] => {
    const rules: PermissionRule[] = [];

    // Classification-based rules
    switch (classification) {
      case 'public':
        rules.push({
          icon: Eye,
          title: 'Öffentlich zugänglich',
          description: 'Alle angemeldeten Benutzer können dieses Dokument sehen',
          type: 'allowed'
        });
        break;

      case 'internal':
        rules.push({
          icon: Users,
          title: 'Abteilungsinterne Freigabe',
          description: `Nur Mitarbeiter der Abteilung „${userDepartment}" können zugreifen`,
          type: 'info'
        });
        break;

      case 'confidential':
        rules.push({
          icon: Shield,
          title: 'Vertraulich — Manager+',
          description: 'Nur Manager und Administratoren können zugreifen',
          type: 'restricted'
        });
        break;

      case 'restricted':
        rules.push({
          icon: Lock,
          title: 'Eingeschränkt — Nur Admins',
          description: 'Nur Administratoren können zugreifen',
          type: 'restricted'
        });
        break;
    }

    // Visibility-based rules
    switch (visibility) {
      case 'only_me':
        rules.push({
          icon: Users,
          title: 'Privater Zugriff',
          description: 'Nur Sie können dieses Dokument sehen und bearbeiten',
          type: 'info'
        });
        break;

      case 'department':
        if (classification === 'public') {
          rules.push({
            icon: AlertTriangle,
            title: 'Klassifizierung überschreibt Sichtbarkeit',
            description: 'Da das Dokument als „Öffentlich" klassifiziert ist, können alle Benutzer darauf zugreifen',
            type: 'info'
          });
        }
        break;

      case 'all_users':
        if (classification !== 'public') {
          rules.push({
            icon: AlertTriangle,
            title: 'Klassifizierung schränkt Zugriff ein',
            description: 'Trotz „Alle Benutzer" gilt die Klassifizierungseinschränkung',
            type: 'info'
          });
        }
        break;

      case 'specific_users':
        if (specificUsers.length > 0) {
          rules.push({
            icon: Users,
            title: `Spezifische Benutzer (${specificUsers.length})`,
            description: `Zusätzlich zu den Klassifizierungsregeln: ${specificUsers.slice(0, 2).join(', ')}${specificUsers.length > 2 ? `... (+${specificUsers.length - 2} weitere)` : ''}`,
            type: 'info'
          });
        } else {
          rules.push({
            icon: AlertTriangle,
            title: 'Keine spezifischen Benutzer',
            description: 'Sie haben keine spezifischen Benutzer hinzugefügt',
            type: 'info'
          });
        }
        break;
    }

    // Owner rule
    rules.push({
      icon: CheckCircle,
      title: 'Eigentümerrechte',
      description: 'Sie haben als Dokumenteigentümer immer vollen Zugriff',
      type: 'allowed'
    });

    return rules;
  };

  const rules = getPermissionRules();

  const getRuleColors = (type: 'allowed' | 'restricted' | 'info') => {
    switch (type) {
      case 'allowed':
        return {
          icon: isDark ? 'text-emerald-400' : 'text-emerald-600',
          bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
          dot: isDark ? 'bg-emerald-400' : 'bg-emerald-500'
        };
      case 'restricted':
        return {
          icon: isDark ? 'text-red-400' : 'text-red-600',
          bg: isDark ? 'bg-red-500/10' : 'bg-red-50',
          dot: isDark ? 'bg-red-400' : 'bg-red-500'
        };
      case 'info':
        return {
          icon: isDark ? 'text-blue-400' : 'text-blue-600',
          bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
          dot: isDark ? 'bg-blue-400' : 'bg-blue-500'
        };
    }
  };

  return (
    <div>
      <label
        className={`
          block text-xs font-semibold uppercase tracking-wider mb-2.5
          ${isDark ? 'text-gray-400' : 'text-gray-500'}
        `}
      >
        Berechtigungsvorschau
      </label>

      <div
        className={`
          rounded-xl overflow-hidden
          ${isDark
            ? 'bg-white/[0.02] border border-white/[0.06]'
            : 'bg-white border border-gray-200/80 shadow-sm'
          }
        `}
      >
        {/* Header with classification accent */}
        <div className={`
          relative px-4 py-3 border-b
          ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}
        `}>
          {/* Top accent line */}
          <div className={`
            absolute top-0 left-0 right-0 h-0.5
            ${isDark ? colors.accent.dark : colors.accent.light}
          `} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className={`
                w-4 h-4
                ${isDark ? colors.icon.dark : colors.icon.light}
              `} />
              <div>
                <span className={`
                  text-sm font-medium
                  ${isDark ? 'text-gray-200' : 'text-gray-800'}
                `}>
                  {CLASSIFICATION_LABELS[classification]}
                </span>
                <span className={`
                  text-xs ml-2
                  ${isDark ? 'text-gray-600' : 'text-gray-400'}
                `}>
                  / {VISIBILITY_LABELS[visibility]}
                </span>
              </div>
            </div>

            {/* Classification badge */}
            <span className={`
              text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ring-1
              ${isDark ? colors.badge.dark : colors.badge.light}
            `}>
              {classification}
            </span>
          </div>
        </div>

        {/* Permission Rules */}
        <div className="px-4 py-3 space-y-2.5">
          {rules.map((rule, index) => {
            const Icon = rule.icon;
            const ruleColors = getRuleColors(rule.type);

            return (
              <div
                key={index}
                className={`
                  flex items-start gap-3 p-2.5 rounded-lg
                  ${isDark ? 'bg-white/[0.02]' : 'bg-gray-50/50'}
                `}
              >
                <div className={`
                  p-1 rounded-md shrink-0 mt-0.5
                  ${ruleColors.bg}
                `}>
                  <Icon className={`w-3 h-3 ${ruleColors.icon}`} />
                </div>
                <div className="min-w-0">
                  <div className={`
                    text-xs font-medium
                    ${isDark ? 'text-gray-200' : 'text-gray-800'}
                  `}>
                    {rule.title}
                  </div>
                  <div className={`
                    text-[11px] mt-0.5 leading-relaxed
                    ${isDark ? 'text-gray-500' : 'text-gray-500'}
                  `}>
                    {rule.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary footer */}
        <div className={`
          px-4 py-3 border-t text-[11px] leading-relaxed
          ${isDark
            ? 'border-white/[0.06] text-gray-600'
            : 'border-gray-100 text-gray-400'
          }
        `}>
          Zugriffskontrolle wird zur Laufzeit basierend auf Benutzerrolle, Abteilung und RLS-Richtlinien durchgeführt.
        </div>
      </div>
    </div>
  );
}
