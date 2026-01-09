import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file from server directory
config({ path: resolve(__dirname, '../../.env') })

// Environment configuration with defaults
export const env = {
  // Server
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  // Ollama
  OLLAMA_API_URL: process.env.OLLAMA_API_URL ?? 'http://localhost:11434',
  OLLAMA_DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL ?? 'qwen3:8b',

  // CORS
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173').split(
    ','
  ),

  // Helpers
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
} as const

// Log config in development
if (env.isDevelopment) {
  console.log('📋 Environment Config:')
  console.log(`   PORT: ${env.PORT}`)
  console.log(`   NODE_ENV: ${env.NODE_ENV}`)
  console.log(`   OLLAMA_API_URL: ${env.OLLAMA_API_URL}`)
  console.log(`   OLLAMA_DEFAULT_MODEL: ${env.OLLAMA_DEFAULT_MODEL}`)
  console.log(`   CORS_ORIGINS: ${env.CORS_ORIGINS.join(', ')}`)
}

export default env
