/**
 * IntentDetectionTest Component
 *
 * Test component to verify the intelligent RAG activation system
 * Shows how different queries are classified for RAG activation
 */

import { useState } from 'react';
import { Brain, MessageSquare, Building, HelpCircle } from 'lucide-react';
import { useTheme } from '../contexts';
import { analyzeIntent, type IntentAnalysis } from '../lib/intentDetection';

export function IntentDetectionTest() {
  const { isDark } = useTheme();
  const [testQuery, setTestQuery] = useState('');
  const [analysis, setAnalysis] = useState<IntentAnalysis | null>(null);

  // Pre-defined test queries
  const testCases = [
    { query: 'Hallo, wie geht es dir?', expected: 'smalltalk' },
    { query: 'Was ist unsere Pricing-Strategie?', expected: 'business' },
    { query: 'Erkläre unseren Workflow', expected: 'business' },
    { query: 'Wie ist das Wetter heute?', expected: 'smalltalk' },
    { query: 'Wie funktioniert unser Onboarding-Prozess?', expected: 'business' },
    { query: 'Danke für deine Hilfe', expected: 'smalltalk' },
    { query: 'Zeige mir unsere Unternehmensrichtlinien', expected: 'business' },
    { query: 'Wer bist du?', expected: 'smalltalk' },
  ];

  const handleAnalyze = (query: string) => {
    if (!query.trim()) return;
    const result = analyzeIntent(query);
    setAnalysis(result);
    setTestQuery(query);
  };

  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case 'smalltalk':
        return <MessageSquare className="w-4 h-4" />;
      case 'business':
        return <Building className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'smalltalk':
        return isDark ? 'text-blue-400 bg-blue-500/20' : 'text-blue-700 bg-blue-100';
      case 'business':
        return isDark ? 'text-green-400 bg-green-500/20' : 'text-green-700 bg-green-100';
      default:
        return isDark ? 'text-yellow-400 bg-yellow-500/20' : 'text-yellow-700 bg-yellow-100';
    }
  };

  return (
    <div className={`p-6 rounded-lg border ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-semibold">Intent Detection Test</h3>
      </div>

      {/* Custom Query Input */}
      <div className="space-y-3 mb-6">
        <label className="block text-sm font-medium">
          Teste eigene Query:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Gib eine Frage oder Nachricht ein..."
            className={`
              flex-1 px-3 py-2 rounded-md border
              transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500
              ${isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }
            `}
            onKeyPress={(e) => e.key === 'Enter' && handleAnalyze(testQuery)}
          />
          <button
            onClick={() => handleAnalyze(testQuery)}
            disabled={!testQuery.trim()}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${!testQuery.trim()
                ? 'opacity-50 cursor-not-allowed'
                : isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
              ${isDark ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}
            `}
          >
            Analysieren
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className={`p-4 rounded-lg border mb-6 ${
          isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
        }`}>
          <h4 className="font-medium mb-3">Analyse Ergebnis:</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getIntentIcon(analysis.intent)}
              <span className={`px-2 py-1 rounded text-xs font-medium ${getIntentColor(analysis.intent)}`}>
                {analysis.intent.toUpperCase()}
              </span>
              <span className="text-sm">
                Confidence: {Math.round(analysis.confidence * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">RAG Aktivierung:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                analysis.shouldActivateRAG
                  ? (isDark ? 'text-green-400 bg-green-500/20' : 'text-green-700 bg-green-100')
                  : (isDark ? 'text-red-400 bg-red-500/20' : 'text-red-700 bg-red-100')
              }`}>
                {analysis.shouldActivateRAG ? 'JA' : 'NEIN'}
              </span>
            </div>
            {analysis.reasoning && (
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Begründung: {analysis.reasoning}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Cases */}
      <div>
        <h4 className="font-medium mb-3">Vordefinierte Test Cases:</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {testCases.map((testCase, index) => (
            <button
              key={index}
              onClick={() => handleAnalyze(testCase.query)}
              className={`
                p-3 text-left rounded-lg border transition-colors duration-150
                hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isDark
                  ? 'bg-gray-700 border-gray-600 hover:bg-gray-650 text-gray-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                }
              `}
            >
              <div className="text-sm font-medium mb-1">{testCase.query}</div>
              <div className="flex items-center gap-1">
                {getIntentIcon(testCase.expected)}
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Erwartet: {testCase.expected}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}