/**
 * ProfilePage Component - User Profile Information Display
 * Displays user's personal information in read-only format
 * Uses MANDATORY TailwindCSS styling with theme support
 */

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { User, Mail, Shield, Building, Clock, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProfilePage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Redirect if not authenticated
  if (!user) {
    navigate('/login');
    return null;
  }

  // Format last login date
  const formatLastLogin = (date?: Date | string | null) => {
    if (!date) return 'Nie';
    const loginDate = typeof date === 'string' ? new Date(date) : date;
    return loginDate.toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Provider display names
  const providerNames = {
    microsoft: 'Microsoft',
    google: 'Google'
  } as const;

  // Role display colors following TailwindCSS conventions
  const roleColors = {
    Admin: isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
    Manager: isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
    Employee: isDark ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div
      className={`
        min-h-screen
        ${isDark ? 'bg-background' : 'bg-white'}
      `.trim()}
    >
      {/* Navigation Header */}
      <div
        className={`
          border-b
          ${isDark ? 'border-white/10 bg-surface' : 'border-gray-200 bg-white'}
        `.trim()}
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg
                transition-colors duration-150 text-sm font-medium
                ${isDark
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                }
                focus:outline-none focus:ring-2
                ${isDark ? 'focus:ring-white/20' : 'focus:ring-black/20'}
              `.trim()}
            >
              ← Zurück
            </button>
            <div>
              <h1
                className={`
                  text-xl font-semibold
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `.trim()}
              >
                Mein Profil
              </h1>
              <p
                className={`
                  text-sm
                  ${isDark ? 'text-gray-400' : 'text-gray-500'}
                `.trim()}
              >
                Persönliche Informationen anzeigen
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div
          className={`
            rounded-xl border shadow-sm
            ${isDark ? 'bg-surface border-white/10' : 'bg-white border-gray-200'}
          `.trim()}
        >
          {/* Profile Header */}
          <div
            className={`
              p-6 border-b
              ${isDark ? 'border-white/10' : 'border-gray-200'}
            `.trim()}
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className={`
                  w-16 h-16 rounded-full flex items-center justify-center
                  ${isDark ? 'bg-white/10' : 'bg-gray-100'}
                `.trim()}
              >
                <User
                  size={32}
                  className={isDark ? 'text-gray-400' : 'text-gray-500'}
                />
              </div>

              {/* User Info */}
              <div className="flex-1">
                <h2
                  className={`
                    text-2xl font-semibold
                    ${isDark ? 'text-white' : 'text-gray-900'}
                  `.trim()}
                >
                  {user.name}
                </h2>
                <p
                  className={`
                    text-sm mt-1
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `.trim()}
                >
                  {user.email}
                </p>

                {/* Role Badge */}
                <div className="mt-3">
                  <span
                    className={`
                      inline-flex items-center gap-2 px-3 py-1.5
                      text-xs font-medium rounded-full border
                      ${roleColors[user.role]}
                    `.trim()}
                  >
                    <Shield size={12} />
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Email */}
              <div
                className={`
                  p-4 rounded-lg
                  ${isDark ? 'bg-white/5' : 'bg-gray-50'}
                `.trim()}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Mail
                    size={20}
                    className={isDark ? 'text-blue-400' : 'text-blue-600'}
                  />
                  <h3
                    className={`
                      font-medium
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `.trim()}
                  >
                    E-Mail-Adresse
                  </h3>
                </div>
                <p
                  className={`
                    text-sm
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `.trim()}
                >
                  {user.email}
                </p>
              </div>

              {/* Role */}
              <div
                className={`
                  p-4 rounded-lg
                  ${isDark ? 'bg-white/5' : 'bg-gray-50'}
                `.trim()}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Shield
                    size={20}
                    className={isDark ? 'text-green-400' : 'text-green-600'}
                  />
                  <h3
                    className={`
                      font-medium
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `.trim()}
                  >
                    Rolle
                  </h3>
                </div>
                <p
                  className={`
                    text-sm
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `.trim()}
                >
                  {user.role}
                </p>
              </div>

              {/* Department */}
              {user.department && (
                <div
                  className={`
                    p-4 rounded-lg
                    ${isDark ? 'bg-white/5' : 'bg-gray-50'}
                  `.trim()}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Building
                      size={20}
                      className={isDark ? 'text-purple-400' : 'text-purple-600'}
                    />
                    <h3
                      className={`
                        font-medium
                        ${isDark ? 'text-white' : 'text-gray-900'}
                      `.trim()}
                    >
                      Abteilung
                    </h3>
                  </div>
                  <p
                    className={`
                      text-sm
                      ${isDark ? 'text-gray-300' : 'text-gray-700'}
                    `.trim()}
                  >
                    {user.department}
                  </p>
                </div>
              )}

              {/* Provider */}
              <div
                className={`
                  p-4 rounded-lg
                  ${isDark ? 'bg-white/5' : 'bg-gray-50'}
                `.trim()}
              >
                <div className="flex items-center gap-3 mb-2">
                  <ExternalLink
                    size={20}
                    className={isDark ? 'text-orange-400' : 'text-orange-600'}
                  />
                  <h3
                    className={`
                      font-medium
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `.trim()}
                  >
                    Anmeldeanbieter
                  </h3>
                </div>
                <p
                  className={`
                    text-sm
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `.trim()}
                >
                  {providerNames[user.provider]}
                </p>
              </div>

              {/* Last Login */}
              <div
                className={`
                  p-4 rounded-lg
                  ${user.department ? '' : 'md:col-span-2'}
                  ${isDark ? 'bg-white/5' : 'bg-gray-50'}
                `.trim()}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Clock
                    size={20}
                    className={isDark ? 'text-gray-400' : 'text-gray-600'}
                  />
                  <h3
                    className={`
                      font-medium
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `.trim()}
                  >
                    Letzter Login
                  </h3>
                </div>
                <p
                  className={`
                    text-sm
                    ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  `.trim()}
                >
                  {formatLastLogin(user.last_login)}
                </p>
              </div>
            </div>

            {/* Account Info */}
            <div
              className={`
                mt-6 pt-6 border-t
                ${isDark ? 'border-white/10' : 'border-gray-200'}
              `.trim()}
            >
              <h3
                className={`
                  font-medium mb-3
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `.trim()}
              >
                Konto-Informationen
              </h3>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span
                    className={isDark ? 'text-gray-400' : 'text-gray-500'}
                  >
                    Benutzer-ID:
                  </span>
                  <span
                    className={`
                      font-mono
                      ${isDark ? 'text-gray-300' : 'text-gray-700'}
                    `.trim()}
                  >
                    {user.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span
                    className={isDark ? 'text-gray-400' : 'text-gray-500'}
                  >
                    Konto erstellt:
                  </span>
                  <span
                    className={isDark ? 'text-gray-300' : 'text-gray-700'}
                  >
                    {new Date(user.created_at).toLocaleString('de-DE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span
                    className={isDark ? 'text-gray-400' : 'text-gray-500'}
                  >
                    Status:
                  </span>
                  <span
                    className={`
                      ${user.is_active
                        ? isDark
                          ? 'text-green-400'
                          : 'text-green-600'
                        : isDark
                          ? 'text-red-400'
                          : 'text-red-600'
                      }
                    `.trim()}
                  >
                    {user.is_active ? 'Aktiv' : 'Deaktiviert'}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div
              className={`
                mt-6 p-4 rounded-lg
                ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}
              `.trim()}
            >
              <p
                className={`
                  text-sm
                  ${isDark ? 'text-blue-300' : 'text-blue-700'}
                `.trim()}
              >
                💡 <strong>Hinweis:</strong> Diese Informationen sind schreibgeschützt und können nur von Administratoren geändert werden. Bei Fragen zu Ihren Konto-Daten wenden Sie sich bitte an die IT-Abteilung.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}