/**
 * Contexts - React Context Providers
 * Central export point for all contexts
 */

export { ConversationProvider, useConversations } from './ConversationContext';
export {
  ThemeProvider,
  useTheme,
  getSystemTheme,
  applyTheme,
} from './ThemeContext';

export {
  SettingsProvider,
  useSettings,
  useSetting,
  useFontSize,
  useFeatureEnabled,
} from './SettingsContext';

export {
  ChatProvider,
  useChat,
  useChatMessages,
  useChatStreaming,
  useChatError,
  useChatActions,
} from './ChatContext';

export {
  ToastProvider,
  useToast,
  useToasts,
} from './ToastContext';

export {
  DocumentProvider,
  useDocuments,
} from './DocumentContext';

export {
  RAGProvider,
  useRAG,
} from './RAGContext';

export type { SettingsContextValue } from './SettingsContext';
export type { ChatContextValue } from './ChatContext';
export type { Toast, ToastType } from './ToastContext';
export type { DocumentContextValue, DocumentMetadata, UploadProgress } from './DocumentContext';
export type { RAGContextType } from './RAGContext';
