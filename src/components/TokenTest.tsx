/**
 * TokenTest Component - Test automatic token refresh functionality
 *
 * This component demonstrates automatic token management:
 * - Makes API calls that require authentication
 * - Shows automatic token refresh on 401 responses
 * - Demonstrates automatic logout on refresh failure
 */

import { useState } from 'react';
import { useTheme } from '../contexts';
import { api } from '../lib/httpClient';
import { env } from '../lib/env';

export function TokenTest() {
  const { isDark } = useTheme();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testAuthenticatedEndpoint = async () => {
    setIsLoading(true);
    addResult('🔍 Testing authenticated API endpoint...');

    try {
      // This should trigger token refresh if token is expired
      const response = await api.get(`${env.API_URL}/api/documents`);
      addResult(`✅ API call successful: ${response.totalCount || 0} documents found`);
    } catch (error) {
      addResult(`❌ API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsLoading(false);
  };

  const testHealthEndpoint = async () => {
    setIsLoading(true);
    addResult('🏥 Testing public health endpoint...');

    try {
      // This endpoint doesn't require auth
      const response = await api.get(`${env.API_URL}/api/health`, { skipAuth: true });
      addResult(`✅ Health check successful: ${response.status}`);
    } catch (error) {
      addResult(`❌ Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsLoading(false);
  };

  const simulateTokenExpiry = async () => {
    setIsLoading(true);
    addResult('⏰ Simulating token expiry scenario...');

    try {
      // This will likely fail with 401, triggering refresh attempt
      const response = await api.get(`${env.API_URL}/api/auth/me`);
      addResult(`✅ Auth check successful: ${response.email || 'No user data'}`);
    } catch (error) {
      addResult(`❌ Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsLoading(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className={`
      w-full max-w-2xl mx-auto p-6
      transition-colors duration-150
      ${isDark
        ? 'bg-gray-800 text-gray-100 border-gray-700'
        : 'bg-white text-gray-900 border-gray-300'
      }
      border rounded-lg shadow-lg
    `}>
      <div className="mb-6">
        <h2 className={`
          text-2xl font-bold mb-2
          ${isDark ? 'text-gray-100' : 'text-gray-900'}
        `}>
          🔐 Token Management Test Suite
        </h2>
        <p className={`
          text-sm
          ${isDark ? 'text-gray-400' : 'text-gray-600'}
        `}>
          Test automatic token refresh and authentication handling
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <button
          onClick={testHealthEndpoint}
          disabled={isLoading}
          className={`
            w-full px-4 py-2 rounded-lg font-medium
            transition-colors duration-150
            ${isDark
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
          `}
        >
          🏥 Test Public Health Endpoint
        </button>

        <button
          onClick={testAuthenticatedEndpoint}
          disabled={isLoading}
          className={`
            w-full px-4 py-2 rounded-lg font-medium
            transition-colors duration-150
            ${isDark
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
          `}
        >
          🔒 Test Authenticated Endpoint (Documents)
        </button>

        <button
          onClick={simulateTokenExpiry}
          disabled={isLoading}
          className={`
            w-full px-4 py-2 rounded-lg font-medium
            transition-colors duration-150
            ${isDark
              ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
              : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
          `}
        >
          ⏰ Test Auth Check (Token Refresh Trigger)
        </button>

        <button
          onClick={clearResults}
          disabled={isLoading}
          className={`
            w-full px-4 py-2 rounded-lg font-medium
            transition-colors duration-150
            ${isDark
              ? 'bg-gray-600 hover:bg-gray-500 text-white'
              : 'bg-gray-500 hover:bg-gray-600 text-white'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
          `}
        >
          🗑️ Clear Results
        </button>
      </div>

      <div className="space-y-2">
        <h3 className={`
          font-semibold mb-2
          ${isDark ? 'text-gray-200' : 'text-gray-800'}
        `}>
          📊 Test Results:
        </h3>

        <div className={`
          max-h-64 overflow-y-auto p-3 rounded-lg
          ${isDark
            ? 'bg-gray-900 border-gray-700'
            : 'bg-gray-50 border-gray-200'
          }
          border
        `}>
          {testResults.length === 0 ? (
            <p className={`
              text-sm italic
              ${isDark ? 'text-gray-500' : 'text-gray-400'}
            `}>
              No test results yet. Click a test button to start.
            </p>
          ) : (
            testResults.map((result, index) => (
              <div
                key={index}
                className={`
                  text-sm font-mono
                  ${isDark ? 'text-gray-300' : 'text-gray-700'}
                  ${index > 0 ? 'mt-1' : ''}
                `}
              >
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center justify-center">
          <div className={`
            animate-spin rounded-full h-6 w-6 border-2 border-t-transparent
            ${isDark ? 'border-gray-400' : 'border-gray-600'}
          `} />
          <span className={`
            ml-2 text-sm
            ${isDark ? 'text-gray-400' : 'text-gray-600'}
          `}>
            Running test...
          </span>
        </div>
      )}
    </div>
  );
}