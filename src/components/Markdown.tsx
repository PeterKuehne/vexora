/**
 * Markdown Component
 *
 * Renders markdown content with custom styling for chat messages.
 * Features:
 * - GitHub Flavored Markdown (GFM) support
 * - Custom renderers for headings, lists, code blocks
 * - Syntax highlighting for code blocks via Prism.js
 * - Theme-aware styling
 * - Optimized for AI response formatting
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useTheme } from '../contexts';
import { CodeBlock, extractLanguageFromClassName } from './CodeBlock';

// Import Prism theme
import '../styles/prism-theme.css';

export interface MarkdownProps {
  /** The markdown content to render */
  content: string;
  /** Custom className for the container */
  className?: string;
}

/**
 * Custom renderers for markdown elements
 * These provide consistent styling across the app
 */
function useMarkdownComponents(): Components {
  const { isDark } = useTheme();

  return {
    // Headings
    h1: ({ children }) => (
      <h1
        className={`text-2xl font-bold mt-6 mb-4 pb-2 border-b ${
          isDark ? 'text-white border-white/10' : 'text-gray-900 border-gray-200'
        }`}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={`text-xl font-semibold mt-5 mb-3 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={`text-lg font-semibold mt-4 mb-2 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        className={`text-base font-semibold mt-3 mb-2 ${
          isDark ? 'text-gray-200' : 'text-gray-800'
        }`}
      >
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5
        className={`text-sm font-semibold mt-2 mb-1 ${
          isDark ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6
        className={`text-sm font-medium mt-2 mb-1 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}
      >
        {children}
      </h6>
    ),

    // Paragraphs
    p: ({ children }) => (
      <p
        className={`my-2 leading-relaxed ${
          isDark ? 'text-gray-200' : 'text-gray-700'
        }`}
      >
        {children}
      </p>
    ),

    // Lists
    ul: ({ children }) => (
      <ul
        className={`my-2 ml-4 list-disc space-y-1 ${
          isDark ? 'text-gray-200' : 'text-gray-700'
        }`}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={`my-2 ml-4 list-decimal space-y-1 ${
          isDark ? 'text-gray-200' : 'text-gray-700'
        }`}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="ml-2">{children}</li>
    ),

    // Code - Inline code styling
    code: ({ className, children }) => {
      // Check if this is inline code (no className or not inside a pre)
      const isInline = !className;

      if (isInline) {
        return (
          <code
            className={`px-1.5 py-0.5 rounded text-sm font-code ${
              isDark
                ? 'bg-white/10 text-pink-400'
                : 'bg-gray-100 text-pink-600'
            }`}
          >
            {children}
          </code>
        );
      }

      // Block code - extract language and use CodeBlock component
      const language = extractLanguageFromClassName(className);
      const code = typeof children === 'string' ? children : String(children ?? '');

      return (
        <CodeBlock
          code={code.replace(/\n$/, '')} // Remove trailing newline
          language={language}
        />
      );
    },
    // Pre wrapper - just pass through children (CodeBlock handles its own styling)
    pre: ({ children }) => <>{children}</>,

    // Blockquote
    blockquote: ({ children }) => (
      <blockquote
        className={`my-3 pl-4 border-l-4 italic ${
          isDark
            ? 'border-primary/50 text-gray-400'
            : 'border-primary/50 text-gray-600'
        }`}
      >
        {children}
      </blockquote>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline transition-colors ${
          isDark
            ? 'text-primary hover:text-primary/80'
            : 'text-primary hover:text-primary/80'
        }`}
      >
        {children}
      </a>
    ),

    // Horizontal Rule
    hr: () => (
      <hr
        className={`my-4 border-t ${
          isDark ? 'border-white/10' : 'border-gray-200'
        }`}
      />
    ),

    // Strong/Bold
    strong: ({ children }) => (
      <strong className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {children}
      </strong>
    ),

    // Emphasis/Italic
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),

    // Tables (GFM)
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table
          className={`min-w-full border-collapse ${
            isDark ? 'border-white/10' : 'border-gray-200'
          }`}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead
        className={isDark ? 'bg-white/5' : 'bg-gray-50'}
      >
        {children}
      </thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr
        className={`border-b ${
          isDark ? 'border-white/10' : 'border-gray-200'
        }`}
      >
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th
        className={`px-3 py-2 text-left text-sm font-semibold ${
          isDark ? 'text-gray-200' : 'text-gray-700'
        }`}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={`px-3 py-2 text-sm ${
          isDark ? 'text-gray-300' : 'text-gray-600'
        }`}
      >
        {children}
      </td>
    ),

    // Images
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt ?? ''}
        className="my-3 max-w-full h-auto rounded-lg"
        loading="lazy"
      />
    ),

    // Delete/Strikethrough (GFM)
    del: ({ children }) => (
      <del className={isDark ? 'text-gray-500' : 'text-gray-400'}>
        {children}
      </del>
    ),
  };
}

/**
 * Markdown component for rendering AI responses
 */
export function Markdown({ content, className = '' }: MarkdownProps) {
  const components = useMarkdownComponents();

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * MarkdownInline - For short inline markdown (no block elements)
 */
export interface MarkdownInlineProps {
  /** The markdown content to render */
  content: string;
  /** Custom className */
  className?: string;
}

export function MarkdownInline({ content, className = '' }: MarkdownInlineProps) {
  const { isDark } = useTheme();

  // Simple inline rendering without plugins for performance
  return (
    <span className={`${isDark ? 'text-gray-200' : 'text-gray-700'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <>{children}</>,
          code: ({ children }) => (
            <code
              className={`px-1 py-0.5 rounded text-sm font-code ${
                isDark
                  ? 'bg-white/10 text-pink-400'
                  : 'bg-gray-100 text-pink-600'
              }`}
            >
              {children}
            </code>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </span>
  );
}
