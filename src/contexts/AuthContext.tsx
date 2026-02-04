import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { httpClient } from '../lib/httpClient';
import { env } from '../lib/env';
import type {
  User
} from '../../server/src/types/auth';

// Frontend types that complement the server types
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

// Create Context with proper TypeScript typing
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook for using AuthContext with type safety
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Ref for proactive token refresh timer
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is already authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Listen for automatic token refresh events from httpClient
  useEffect(() => {
    const handleTokenRefreshed = (event: CustomEvent) => {
      const { user } = event.detail;
      setState(prev => ({
        ...prev,
        user,
        isAuthenticated: true,
        error: null
      }));
    };

    const handleAutoLogout = () => {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired. Please log in again.'
      });
    };

    // Add event listeners
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed as EventListener);
    window.addEventListener('auth:logout', handleAutoLogout);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed as EventListener);
      window.removeEventListener('auth:logout', handleAutoLogout);
    };
  }, []);

  // Proactive token refresh (refresh 5 minutes before expiry)
  const startProactiveRefresh = () => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Access token lifetime: 15 minutes
    // Refresh 5 minutes before expiry = refresh every 10 minutes
    const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

    console.log('⏰ Scheduling proactive token refresh in 10 minutes');

    refreshTimerRef.current = setTimeout(async () => {
      console.log('🔄 Proactive token refresh triggered');
      try {
        const response = await httpClient.post(`${env.API_URL}/api/auth/refresh`, {}, {
          skipAuth: true // Don't trigger automatic retry on this refresh call
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Proactive token refresh successful');

          // Dispatch event to notify about successful refresh
          window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
            detail: { user: data.user }
          }));

          // Schedule next refresh
          startProactiveRefresh();
        } else {
          console.warn('⚠️ Proactive token refresh failed - will retry on next API call');
          // Don't logout here - let the reactive refresh handle it on next API call
          // Schedule retry in 2 minutes
          refreshTimerRef.current = setTimeout(() => startProactiveRefresh(), 2 * 60 * 1000);
        }
      } catch (error) {
        console.error('❌ Proactive token refresh error:', error);
        // Schedule retry in 2 minutes
        refreshTimerRef.current = setTimeout(() => startProactiveRefresh(), 2 * 60 * 1000);
      }
    }, REFRESH_INTERVAL);
  };

  const stopProactiveRefresh = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      console.log('⏹️ Proactive token refresh stopped');
    }
  };

  // Start/stop proactive refresh based on authentication state
  useEffect(() => {
    if (state.isAuthenticated && state.user) {
      startProactiveRefresh();
    } else {
      stopProactiveRefresh();
    }

    // Cleanup on unmount
    return () => {
      stopProactiveRefresh();
    };
  }, [state.isAuthenticated, state.user]);

  // Check authentication status
  const checkAuth = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Use httpClient with skipAuth to avoid infinite loop on 401
      const response = await httpClient.get(`${env.API_URL}/api/auth/me`, {
        skipAuth: true // Skip automatic token refresh for auth check
      });

      if (response.ok) {
        const user: User = await response.json();
        setState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        // Token is invalid or expired
        setState(prev => ({
          ...prev,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        }));
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setState(prev => ({
        ...prev,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to verify authentication'
      }));
    }
  };

  // Initiate Microsoft OAuth login
  const login = async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Redirect to Microsoft OAuth endpoint
      window.location.href = `${env.API_URL}/api/auth/microsoft/login`;
    } catch (error) {
      console.error('Microsoft login failed:', error);
      setState(prev => ({
        ...prev,
        error: 'Microsoft login failed. Please try again.'
      }));
    }
  };

  // Initiate Google OAuth login
  const googleLogin = async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Redirect to Google OAuth endpoint
      window.location.href = `${env.API_URL}/api/auth/google/login`;
    } catch (error) {
      console.error('Google login failed:', error);
      setState(prev => ({
        ...prev,
        error: 'Google login failed. Please try again.'
      }));
    }
  };

  // Logout user
  const logout = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Call logout endpoint to invalidate tokens (cookies will be cleared server-side)
      await httpClient.post(`${env.API_URL}/api/auth/logout`, {}, {
        skipAuth: true // Skip auth handling during logout
      });

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local state even if server call fails
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  };

  // Clear error state
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    googleLogin,
    logout,
    checkAuth,
    clearError
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;