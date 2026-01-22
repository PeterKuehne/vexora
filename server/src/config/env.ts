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
  POSTGRES_DB: process.env.POSTGRES_DB ?? 'vexora',
  POSTGRES_USER: process.env.POSTGRES_USER ?? 'vexora',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'vexora_dev_password',

  // Weaviate
  WEAVIATE_URL: process.env.WEAVIATE_URL ?? 'http://localhost:8080',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET ?? 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

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
