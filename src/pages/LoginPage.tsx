import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { TokenTest } from '../components/TokenTest';

export function LoginPage() {
  const { login, googleLogin, isAuthenticated, isLoading, error, clearError } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleMicrosoftLogin = () => {
    clearError();
    login();
  };

  const handleGoogleLogin = () => {
    clearError();
    googleLogin();
  };

  const isDark = theme === 'dark';

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
          <span className="text-sm font-medium">Überprüfe Anmeldung...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      min-h-screen flex items-center justify-center
      px-4 py-12
      transition-colors duration-150
      ${isDark ? 'bg-gray-900' : 'bg-gray-50'}
    `}>
      <div className={`
        w-full max-w-md space-y-8
      `}>
        {/* Header */}
        <div className="text-center">
          <div className={`
            mx-auto h-16 w-16 flex items-center justify-center rounded-full
            transition-colors duration-150
            ${isDark
              ? 'bg-blue-500/10 text-blue-400'
              : 'bg-blue-500/10 text-blue-600'
            }
          `}>
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className={`
            mt-6 text-3xl font-bold tracking-tight
            transition-colors duration-150
            ${isDark ? 'text-white' : 'text-gray-900'}
          `}>
            Bei Vexora anmelden
          </h2>

          <p className={`
            mt-2 text-sm
            transition-colors duration-150
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}>
            Verwenden Sie Ihren Microsoft- oder Google-Account um sich anzumelden
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`
            p-4 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-red-900/20 border-red-800 text-red-400'
              : 'bg-red-50 border-red-200 text-red-600'
            }
          `}>
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <div className={`
          px-8 py-8 rounded-lg shadow-sm border
          transition-colors duration-150
          ${isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
          }
        `}>
          <div className="space-y-6">
            {/* Microsoft Login Button */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className={`
                w-full flex items-center justify-center
                px-4 py-3 rounded-lg font-medium
                focus:outline-none focus:ring-2 focus:ring-offset-2
                transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                ${isDark
                  ? `
                    bg-blue-600 text-white border border-blue-600
                    hover:bg-blue-700 hover:border-blue-700
                    focus:ring-blue-500 focus:ring-offset-gray-800
                    disabled:bg-blue-800 disabled:border-blue-800
                  `
                  : `
                    bg-blue-600 text-white border border-blue-600
                    hover:bg-blue-700 hover:border-blue-700
                    focus:ring-blue-500 focus:ring-offset-white
                    disabled:bg-blue-400 disabled:border-blue-400
                  `
                }
              `}
            >
              <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
              </svg>
              Mit Microsoft anmelden
            </button>

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className={`
                w-full flex items-center justify-center
                px-4 py-3 rounded-lg font-medium
                focus:outline-none focus:ring-2 focus:ring-offset-2
                transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                ${isDark
                  ? `
                    bg-white text-gray-900 border border-gray-300
                    hover:bg-gray-100 hover:border-gray-400
                    focus:ring-gray-500 focus:ring-offset-gray-800
                    disabled:bg-gray-300 disabled:border-gray-300
                  `
                  : `
                    bg-white text-gray-900 border border-gray-300
                    hover:bg-gray-50 hover:border-gray-400
                    focus:ring-gray-500 focus:ring-offset-white
                    disabled:bg-gray-200 disabled:border-gray-200
                  `
                }
              `}
            >
              <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Mit Google anmelden
            </button>

            {/* Divider */}
            <div className="relative">
              <div className={`
                absolute inset-0 flex items-center
              `}>
                <div className={`
                  w-full border-t
                  transition-colors duration-150
                  ${isDark ? 'border-gray-700' : 'border-gray-200'}
                `} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`
                  px-2
                  transition-colors duration-150
                  ${isDark
                    ? 'bg-gray-800 text-gray-400'
                    : 'bg-white text-gray-500'
                  }
                `}>
                  Enterprise Single Sign-On
                </span>
              </div>
            </div>

            {/* Info */}
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
                  <p className="font-medium mb-1">Sicherer Unternehmens-Login</p>
                  <p className={`
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Ihre Anmeldedaten werden sicher über Microsoft oder Google OAuth2 verarbeitet.
                    Nach der Anmeldung erhalten Sie rollenbasierten Zugriff auf Dokumente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Token Test Component for Development */}
        <div className="mt-8">
          <TokenTest />
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className={`
            text-xs
            transition-colors duration-150
            ${isDark ? 'text-gray-500' : 'text-gray-400'}
          `}>
            Powered by Vexora Enterprise Authentication System
          </p>
        </div>
      </div>
    </div>
  );
}