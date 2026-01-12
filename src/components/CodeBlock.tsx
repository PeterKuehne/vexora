/**
 * CodeBlock Component
 *
 * Syntax highlighted code blocks with Prism.js
 * Features:
 * - Automatic language detection from className
 * - Copy-to-clipboard functionality
 * - Theme-aware styling
 * - Support for 20+ programming languages
 */

import { useMemo, type ReactNode } from 'react';
import Prism from 'prismjs';
import { useTheme } from '../contexts';
import { CopyButtonWithLabel } from './CopyButton';

// Import Prism language components
// Note: Order matters! Some languages depend on others
// Core languages (no dependencies)
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-markup';

// Languages that depend on clike
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-c';

// Languages that depend on javascript
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

// Languages that depend on c
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';

// Standalone languages
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-diff';

export interface CodeBlockProps {
  /** The code to display */
  code: string;
  /** Programming language for syntax highlighting (undefined for auto-detection) */
  language: string | undefined;
  /** Custom className for the container */
  className?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to show the copy button */
  showCopyButton?: boolean;
  /** Whether to show the language label */
  showLanguageLabel?: boolean;
}

// Language aliases mapping
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
};

// Readable language names for display
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  sql: 'SQL',
  bash: 'Bash',
  json: 'JSON',
  yaml: 'YAML',
  css: 'CSS',
  markdown: 'Markdown',
  diff: 'Diff',
  c: 'C',
  clike: 'C-like',
  markup: 'HTML',
};

/**
 * Normalize language name using aliases
 */
function normalizeLanguage(language: string): string {
  const lower = language.toLowerCase().trim();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

/**
 * Get display name for a language
 */
function getLanguageDisplayName(language: string): string {
  const normalized = normalizeLanguage(language);
  return LANGUAGE_DISPLAY_NAMES[normalized] ?? language.toUpperCase();
}

/**
 * Extract language from react-markdown className
 * e.g. "language-typescript" -> "typescript"
 */
export function extractLanguageFromClassName(className?: string): string | undefined {
  if (!className) return undefined;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : undefined;
}

/**
 * Detect language from code content (simple heuristics)
 */
export function detectLanguage(code: string): string {
  const trimmed = code.trim();

  // Common patterns
  if (/^import\s+.*from\s+['"]/.test(trimmed) || /^export\s+(default\s+)?/.test(trimmed)) {
    return 'typescript';
  }
  if (/^<\?php/.test(trimmed)) return 'php';
  if (/^#!\s*\/usr\/bin\/env\s+python/.test(trimmed) || /^def\s+\w+\(/.test(trimmed)) {
    return 'python';
  }
  if (/^#!\s*\/bin\/(bash|sh|zsh)/.test(trimmed) || /^\$\s+/.test(trimmed)) {
    return 'bash';
  }
  if (/^\s*\{[\s\S]*\}$/.test(trimmed) || /^\s*\[[\s\S]*\]$/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/i.test(trimmed)) {
    return 'sql';
  }
  if (/^package\s+main/.test(trimmed)) return 'go';
  if (/^fn\s+\w+/.test(trimmed) || /^use\s+\w+/.test(trimmed)) return 'rust';
  if (/^(class|interface|type)\s+\w+/.test(trimmed)) return 'typescript';
  if (/^const\s+\w+\s*=/.test(trimmed) || /^let\s+\w+\s*=/.test(trimmed)) {
    return 'javascript';
  }

  return 'text';
}

/**
 * CodeBlock component with syntax highlighting
 */
export function CodeBlock({
  code,
  language,
  className = '',
  showLineNumbers = false,
  showCopyButton = true,
  showLanguageLabel = true,
}: CodeBlockProps) {
  const { isDark } = useTheme();

  // Normalize language
  const normalizedLanguage = language
    ? normalizeLanguage(language)
    : detectLanguage(code);

  // Apply Prism highlighting using useMemo for synchronous computation
  const highlightedCode = useMemo(() => {
    if (normalizedLanguage && Prism.languages[normalizedLanguage]) {
      return Prism.highlight(
        code,
        Prism.languages[normalizedLanguage],
        normalizedLanguage
      );
    }
    // Fallback: escape HTML entities
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }, [code, normalizedLanguage]);

  // Split code into lines for line numbers
  const lines = code.split('\n');

  return (
    <div
      className={`relative group rounded-lg overflow-hidden my-3 ${
        isDark ? 'bg-[#1e1e1e]' : 'bg-gray-50'
      } ${className}`}
    >
      {/* Header with language label and copy button */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b ${
          isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-100'
        }`}
      >
        {/* Language label */}
        {showLanguageLabel && normalizedLanguage && normalizedLanguage !== 'text' && (
          <span
            className={`text-xs font-medium ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {getLanguageDisplayName(normalizedLanguage)}
          </span>
        )}
        {(!showLanguageLabel || !normalizedLanguage || normalizedLanguage === 'text') && (
          <span />
        )}

        {/* Copy button */}
        {showCopyButton && (
          <CopyButtonWithLabel
            content={code}
            size="sm"
            variant="ghost"
            label="Kopieren"
            copiedText="Kopiert!"
          />
        )}
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre
          className={`p-4 text-sm font-code leading-relaxed ${
            showLineNumbers ? 'pl-0' : ''
          }`}
        >
          {showLineNumbers ? (
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td
                      className={`select-none text-right pr-4 pl-4 ${
                        isDark ? 'text-gray-600' : 'text-gray-400'
                      }`}
                      style={{ width: '1%', whiteSpace: 'nowrap' }}
                    >
                      {index + 1}
                    </td>
                    <td className="pl-4">
                      <code
                        className={`${isDark ? 'text-gray-200' : 'text-gray-800'}`}
                        dangerouslySetInnerHTML={{
                          __html:
                            normalizedLanguage && Prism.languages[normalizedLanguage]
                              ? Prism.highlight(
                                  line,
                                  Prism.languages[normalizedLanguage],
                                  normalizedLanguage
                                )
                              : line
                                  .replace(/&/g, '&amp;')
                                  .replace(/</g, '&lt;')
                                  .replace(/>/g, '&gt;'),
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <code
              className={`${isDark ? 'text-gray-200' : 'text-gray-800'}`}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          )}
        </pre>
      </div>
    </div>
  );
}

/**
 * CodeBlockWrapper for react-markdown integration
 * Extracts language from className and passes to CodeBlock
 */
export interface CodeBlockWrapperProps {
  children?: ReactNode;
  className?: string;
}

export function CodeBlockWrapper({ children, className }: CodeBlockWrapperProps) {
  const language = extractLanguageFromClassName(className);
  const code = typeof children === 'string' ? children : String(children ?? '');

  return (
    <CodeBlock
      code={code.replace(/\n$/, '')} // Remove trailing newline
      language={language}
    />
  );
}
