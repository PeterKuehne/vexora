/**
 * Error Boundary - React Crash Handler
 *
 * Catches JavaScript errors anywhere in the component tree,
 * logs errors, and displays a fallback UI with recovery options.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      // Custom fallback UI or provided fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback
        error={this.state.error}
        onReset={this.handleReset}
        onReload={this.handleReload}
      />;
    }

    return this.props.children;
  }
}

// Error Fallback UI Component with Theme Support
interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
  onReload: () => void;
}

function ErrorFallback({ error, onReset, onReload }: ErrorFallbackProps) {
  const { isDark } = useTheme();

  return (
    <div className={`
      min-h-screen flex items-center justify-center
      transition-colors duration-150
      ${isDark
        ? 'bg-gray-900 text-white'
        : 'bg-gray-50 text-gray-900'
      }
    `}>
      <div className={`
        max-w-md w-full mx-4 p-6 rounded-lg
        transition-colors duration-150
        ${isDark
          ? 'bg-gray-800 border border-gray-700'
          : 'bg-white border border-gray-200 shadow-sm'
        }
      `}>
        <div className="flex items-center space-x-3 mb-4">
          <div className={`
            p-2 rounded-full
            ${isDark ? 'bg-red-900/50' : 'bg-red-100'}
          `}>
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className={`
            text-lg font-semibold
            ${isDark ? 'text-gray-100' : 'text-gray-900'}
          `}>
            Unerwarteter Fehler
          </h2>
        </div>

        <p className={`
          text-sm mb-6
          ${isDark ? 'text-gray-400' : 'text-gray-600'}
        `}>
          Es ist ein technischer Fehler aufgetreten. Sie können versuchen, die Seite neu zu laden oder die Aktion erneut zu versuchen.
        </p>

        {/* Error Details (nur im Development Mode) */}
        {process.env.NODE_ENV === 'development' && error && (
          <details className={`
            mb-4 p-3 rounded
            ${isDark ? 'bg-gray-900/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'}
          `}>
            <summary className={`
              cursor-pointer text-sm font-medium
              ${isDark ? 'text-gray-300' : 'text-gray-700'}
            `}>
              Technische Details
            </summary>
            <pre className={`
              mt-2 text-xs overflow-auto max-h-32
              ${isDark ? 'text-red-400' : 'text-red-600'}
            `}>
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack}
                </>
              )}
            </pre>
          </details>
        )}

        <div className="flex space-x-3">
          <button
            onClick={onReset}
            className={`
              flex-1 px-4 py-2 text-sm font-medium rounded
              transition-colors duration-150
              ${isDark
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500'
              }
              focus:outline-none focus:ring-2 focus:ring-offset-2
            `}
          >
            Erneut versuchen
          </button>
          <button
            onClick={onReload}
            className={`
              flex-1 px-4 py-2 text-sm font-medium rounded
              transition-colors duration-150
              bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500
              focus:outline-none focus:ring-2 focus:ring-offset-2
            `}
          >
            Seite neu laden
          </button>
        </div>
      </div>
    </div>
  );
}

// Wrapper function component for easy usage
export function ErrorBoundary({ children, fallback }: Props) {
  return (
    <ErrorBoundaryComponent fallback={fallback}>
      {children}
    </ErrorBoundaryComponent>
  );
}

export default ErrorBoundary;