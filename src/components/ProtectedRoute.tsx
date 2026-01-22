import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { UserRole } from '../../server/src/types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, checkAuth } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  const isDark = theme === 'dark';

  // Retry auth check on mount if needed
  useEffect(() => {
    if (!isAuthenticated && !isLoading && !user) {
      checkAuth();
    }
  }, [isAuthenticated, isLoading, user, checkAuth]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className={`
        min-h-screen flex items-center justify-center
        transition-colors duration-150
        ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
      `}>
        <div className={`
          flex items-center space-x-3
          px-6 py-4 rounded-lg
          transition-colors duration-150
          ${isDark
            ? 'text-gray-300 bg-gray-800/50'
            : 'text-gray-600 bg-white/50'
          }
        `}>
          <div className={`
            w-5 h-5 border-2 border-t-transparent rounded-full animate-spin
            transition-colors duration-150
            ${isDark ? 'border-gray-400' : 'border-gray-500'}
          `} />
          <span className="text-sm font-medium">Lade Anwendung...</span>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    // Preserve the intended destination in state
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role-based access if required
  if (requiredRole && user.role !== requiredRole) {
    // Check role hierarchy: Admin > Manager > Employee
    const roleHierarchy: Record<UserRole, number> = {
      'Admin': 3,
      'Manager': 2,
      'Employee': 1
    };

    const userLevel = roleHierarchy[user.role];
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return (
        <div className={`
          min-h-screen flex items-center justify-center
          px-4 py-12
          transition-colors duration-150
          ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
        `}>
          <div className={`
            max-w-md text-center space-y-6
            p-8 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
            }
          `}>
            {/* Access Denied Icon */}
            <div className={`
              mx-auto h-16 w-16 flex items-center justify-center rounded-full
              transition-colors duration-150
              ${isDark
                ? 'bg-red-500/10 text-red-400'
                : 'bg-red-500/10 text-red-600'
              }
            `}>
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className={`
                text-xl font-bold
                transition-colors duration-150
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                Zugriff verweigert
              </h2>

              <p className={`
                text-sm
                transition-colors duration-150
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                Diese Seite erfordert <span className="font-medium">{requiredRole}</span>-Berechtigung.
                <br />
                Ihr aktueller Status: <span className="font-medium">{user.role}</span>
              </p>
            </div>

            <div className={`
              p-4 rounded-lg
              transition-colors duration-150
              ${isDark
                ? 'bg-gray-700/50 text-gray-300'
                : 'bg-gray-50 text-gray-600'
              }
            `}>
              <div className="flex">
                <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs">
                  <p className="font-medium mb-1">Berechtigung anfordern</p>
                  <p className={`
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Wenden Sie sich an Ihren Administrator, um höhere Berechtigungen zu erhalten.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.history.back()}
              className={`
                w-full px-4 py-2 rounded-lg font-medium
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-offset-2
                ${isDark
                  ? `
                    bg-gray-700 text-gray-200 border border-gray-600
                    hover:bg-gray-600 hover:border-gray-500
                    focus:ring-gray-500 focus:ring-offset-gray-800
                  `
                  : `
                    bg-gray-100 text-gray-700 border border-gray-300
                    hover:bg-gray-200 hover:border-gray-400
                    focus:ring-gray-500 focus:ring-offset-white
                  `
                }
              `}
            >
              Zurück
            </button>
          </div>
        </div>
      );
    }
  }

  // User is authenticated and has sufficient permissions
  return <>{children}</>;
}