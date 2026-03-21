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

  // PostgreSQL
  POSTGRES_HOST: process.env.POSTGRES_HOST ?? 'localhost',
  POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  POSTGRES_DB: process.env.POSTGRES_DB ?? 'cor7ex',
  POSTGRES_USER: process.env.POSTGRES_USER ?? 'cor7ex',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'cor7ex_dev_password',

  // Weaviate
  WEAVIATE_URL: process.env.WEAVIATE_URL ?? 'http://localhost:8080',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET ?? 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  // LLM Providers
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',

  // PII Guard (Presidio)
  PII_GUARD_ENABLED: process.env.PII_GUARD_ENABLED !== 'false',
  PRESIDIO_ANALYZER_URL: process.env.PRESIDIO_ANALYZER_URL ?? 'http://192.168.2.38:8003',
  PRESIDIO_ANONYMIZER_URL: process.env.PRESIDIO_ANONYMIZER_URL ?? 'http://192.168.2.38:8004',
  PII_MIN_CONFIDENCE: parseFloat(process.env.PII_MIN_CONFIDENCE ?? '0.7'),

  // Security
  FRONTEND_URL: process.env.FRONTEND_URL ?? (process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com'
    : 'http://localhost:5173'),
  BACKEND_URL: process.env.BACKEND_URL ?? (process.env.NODE_ENV === 'production'
    ? 'https://api.your-domain.com'
    : 'http://localhost:3001'),

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
