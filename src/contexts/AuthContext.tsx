import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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

  // Check if user is already authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Check authentication status
  const checkAuth = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Use cookies instead of localStorage for httpOnly tokens
      // The /api/auth/me endpoint will read from cookies automatically
      const response = await fetch('http://localhost:3001/api/auth/me', {
        credentials: 'include' // This sends cookies
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
      window.location.href = 'http://localhost:3001/api/auth/microsoft/login';
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
      window.location.href = 'http://localhost:3001/api/auth/google/login';
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
      await fetch('http://localhost:3001/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
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