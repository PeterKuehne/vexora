/**
 * PermissionPreview - Shows effective document permissions
 *
 * Features:
 * - Clear visualization of who can access the document
 * - Classification level impact explanation
 * - TailwindCSS styling with theme support (MANDATORY)
 * - User-friendly permission summary
 */

import { Shield, Users, Eye, Lock, AlertTriangle } from 'lucide-react';
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

export function PermissionPreview({
  classification,
  visibility,
  specificUsers,
  department
}: PermissionPreviewProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const userDepartment = department || user?.department || 'Unbekannt';

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
          description: `Nur Mitarbeiter der Abteilung "${userDepartment}" können zugreifen`,
          type: 'info'
        });
        break;

      case 'confidential':
        rules.push({
          icon: Shield,
          title: 'Vertraulich - Manager+',
          description: 'Nur Manager und Administratoren können zugreifen',
          type: 'restricted'
        });
        break;

      case 'restricted':
        rules.push({
          icon: Lock,
          title: 'Eingeschränkt - Nur Admins',
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
            description: 'Da das Dokument als "Öffentlich" klassifiziert ist, können alle Benutzer darauf zugreifen',
            type: 'info'
          });
        }
        break;

      case 'all_users':
        if (classification !== 'public') {
          rules.push({
            icon: AlertTriangle,
            title: 'Klassifizierung schränkt Zugriff ein',
            description: 'Trotz "Alle Benutzer" gilt die Klassifizierungseinschränkung',
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
      icon: Users,
      title: 'Eigentümerrechte',
      description: 'Sie haben als Dokumenteigentümer immer vollen Zugriff',
      type: 'allowed'
    });

    return rules;
  };

  const rules = getPermissionRules();

  const getIconColor = (type: 'allowed' | 'restricted' | 'info') => {
    switch (type) {
      case 'allowed':
        return 'text-green-600';
      case 'restricted':
        return 'text-red-600';
      case 'info':
        return isDark ? 'text-blue-400' : 'text-blue-600';
    }
  };

  return (
    <div>
      <label
        className={`
          block text-sm font-medium mb-3
          ${isDark ? 'text-gray-200' : 'text-gray-800'}
        `}
      >
        Berechtigungsvorschau
      </label>

      <div
        className={`
          border rounded-lg p-4
          ${isDark
            ? 'border-gray-600 bg-gray-800/30'
            : 'border-gray-300 bg-gray-50/50'
          }
        `}
      >
        <div
          className={`
            flex items-center mb-3 pb-3 border-b
            ${isDark ? 'border-gray-600' : 'border-gray-300'}
          `}
        >
          <Shield
            className={`
              w-5 h-5 mr-2
              ${classification === 'restricted'
                ? 'text-red-600'
                : classification === 'confidential'
                  ? 'text-orange-600'
                  : classification === 'internal'
                    ? 'text-blue-600'
                    : 'text-green-600'
              }
            `}
          />
          <div>
            <div
              className={`
                font-medium
                ${isDark ? 'text-gray-200' : 'text-gray-800'}
              `}
            >
              Klassifizierung: {classification.charAt(0).toUpperCase() + classification.slice(1)}
            </div>
            <div
              className={`
                text-sm
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}
            >
              Sichtbarkeit: {
                visibility === 'only_me' ? 'Nur ich' :
                visibility === 'department' ? 'Abteilung' :
                visibility === 'all_users' ? 'Alle Benutzer' :
                'Bestimmte Benutzer'
              }
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {rules.map((rule, index) => {
            const Icon = rule.icon;
            return (
              <div key={index} className="flex items-start">
                <Icon
                  className={`
                    w-4 h-4 mr-3 mt-0.5 flex-shrink-0
                    ${getIconColor(rule.type)}
                  `}
                />
                <div>
                  <div
                    className={`
                      text-sm font-medium
                      ${isDark ? 'text-gray-200' : 'text-gray-800'}
                    `}
                  >
                    {rule.title}
                  </div>
                  <div
                    className={`
                      text-xs mt-0.5
                      ${isDark ? 'text-gray-400' : 'text-gray-600'}
                    `}
                  >
                    {rule.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div
          className={`
            mt-4 pt-3 border-t text-xs
            ${isDark
              ? 'border-gray-600 text-gray-400'
              : 'border-gray-300 text-gray-600'
            }
          `}
        >
          <strong>Zusammenfassung:</strong> Dieses Dokument wird entsprechend der Klassifizierung "{classification}"
          und PostgreSQL RLS-Richtlinien verwaltet. Die finale Zugriffskontrolle wird zur Laufzeit basierend auf
          Benutzerrolle, Abteilung und spezifischen Berechtigungen durchgeführt.
        </div>
      </div>
    </div>
  );
}