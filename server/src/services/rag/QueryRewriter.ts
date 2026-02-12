/**
 * QueryRewriter - Resolves pronouns and references in follow-up questions
 * using the chat history, so the vector search receives a self-contained query.
 *
 * Key design decisions (based on LangChain/LlamaIndex patterns):
 * - Uses think:false to disable Qwen3 thinking mode (avoids empty responses)
 * - Truncates assistant messages to ~500 chars (only topic context needed)
 * - Uses Qwen3-safe sampling params (no greedy decoding / temperature:0)
 */

import { ollamaService } from '../OllamaService.js'
import type { ChatMessage } from '../../validation/index.js'

// Pronoun / reference patterns that strongly indicate an unresolved reference.
// Intentionally excludes common German articles/pronouns (das, es, sie, dem, der, den)
// that appear in almost every sentence and would cause unnecessary rewrites.
const REFERENCE_PATTERNS = [
  // German – demonstratives & pronominal adverbs (strong reference signals)
  /\bdies(e[rsmn]?)?\b/i,   // dies, diese, dieser, diesem, diesen, dieses
  /\bdazu\b/i,
  /\bdavon\b/i,
  /\bdarüber\b/i,
  /\bdarauf\b/i,
  /\bdarin\b/i,
  /\bdaran\b/i,
  /\bdamit\b/i,
  /\bwelche[rsmn]?\b/i,
  /\bobige[rsmn]?\b/i,
  /\bgenannte[rsmn]?\b/i,
  /\bbesagt(e[rsmn]?)?\b/i,
  /\bdem Dokument\b/i,      // "dem Dokument" as explicit reference phrase
  /\bdem PDF\b/i,
  /\bdem Text\b/i,
  /\bder Datei\b/i,
  // English – demonstratives & reference phrases
  /\bthis\b/i,
  /\bthat\b/i,
  /\bthese\b/i,
  /\bthose\b/i,
  /\bthe document\b/i,
  /\bthe file\b/i,
  /\bthe PDF\b/i,
]

const REWRITE_SYSTEM_PROMPT = `Du bist ein Assistent zum Umschreiben von Suchanfragen. Schreibe die letzte Frage so um, dass sie ohne den Gesprächsverlauf verständlich ist.
Regeln:
- Beantworte die Frage NICHT, schreibe sie nur um
- Wenn die Frage bereits eigenständig ist, gib sie unverändert zurück
- Löse alle Pronomen und Referenzen mit dem Gesprächskontext auf
- Halte die umgeschriebene Frage kurz (unter 50 Wörter)
- Gib NUR die umgeschriebene Frage zurück, keine Erklärung`

const MAX_HISTORY_MESSAGES = 6 // last 3 Q/A pairs
const MAX_ASSISTANT_CONTENT_LENGTH = 500 // truncate long assistant responses

/**
 * Strip any residual <think>…</think> blocks from LLM output (safety net).
 */
function cleanResponse(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

export class QueryRewriter {
  /**
   * Check whether the query likely contains unresolved references
   * that need the chat history to be understood.
   */
  needsRewriting(query: string, messages: ChatMessage[]): boolean {
    // Never rewrite the first user message (no history to resolve against)
    const userMessages = messages.filter((m) => m.role === 'user')
    if (userMessages.length <= 1) return false

    return REFERENCE_PATTERNS.some((pattern) => pattern.test(query))
  }

  /**
   * Rewrite the query so it is self-contained, using chat history for context.
   * Returns the original query unchanged if rewriting is not needed or fails.
   */
  async rewrite(query: string, messages: ChatMessage[], model: string): Promise<string> {
    if (!this.needsRewriting(query, messages)) {
      return query
    }

    try {
      // Trim history to the last N messages and truncate long assistant responses
      const recentHistory = messages.slice(-MAX_HISTORY_MESSAGES)

      const rewriteMessages = [
        { role: 'system' as const, content: REWRITE_SYSTEM_PROMPT },
        ...recentHistory.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.role === 'assistant' && m.content.length > MAX_ASSISTANT_CONTENT_LENGTH
            ? m.content.substring(0, MAX_ASSISTANT_CONTENT_LENGTH) + '...'
            : m.content,
        })),
      ]

      const response = await ollamaService.chat({
        messages: rewriteMessages,
        model,
        think: false, // Disable Qwen3 thinking mode — avoids empty responses
        options: {
          num_predict: 150,
          temperature: 0.7, // Qwen3 forbids temperature:0 (greedy decoding)
          top_p: 0.8,
          top_k: 20,
        },
      })

      // Clean any residual think tags (safety net)
      const rewritten = cleanResponse(response.message.content)

      // Sanity check: if the LLM returned something empty or way too long, fall back
      if (!rewritten || rewritten.length > 500) {
        console.warn(`⚠️ Query rewrite produced unusable result (len=${rewritten.length}), using original`)
        return query
      }

      console.log(`🔄 Query rewritten: "${query}" → "${rewritten}"`)
      return rewritten
    } catch (error) {
      console.warn('⚠️ Query rewriting failed (using original query):', error)
      return query
    }
  }
}
