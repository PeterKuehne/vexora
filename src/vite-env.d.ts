/// <reference types="vite/client" />

/**
 * Custom environment variables for Qwen Chat
 * Extends Vite's built-in ImportMetaEnv
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_SOCKET_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
