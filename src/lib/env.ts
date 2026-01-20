/**
 * Frontend Environment Configuration
 *
 * All VITE_ prefixed environment variables are exposed to the frontend.
 * Configure in .env file or via command line.
 */

export const env = {
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  WS_URL: import.meta.env.VITE_WS_URL ?? 'http://localhost:3001',

  // App Info
  APP_NAME: import.meta.env.VITE_APP_NAME ?? 'Vexora',
  APP_VERSION: import.meta.env.VITE_APP_VERSION ?? '0.1.0',

  // Build Mode
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
} as const

// Log config in development
if (env.DEV) {
  console.log('📋 Frontend Environment:')
  console.log(`   API_URL: ${env.API_URL}`)
  console.log(`   WS_URL: ${env.WS_URL}`)
  console.log(`   APP_NAME: ${env.APP_NAME}`)
  console.log(`   MODE: ${env.MODE}`)
}

export default env
