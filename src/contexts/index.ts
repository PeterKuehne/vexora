/**
 * Contexts - React Context Providers
 * Central export point for all contexts
 */

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
  ToastProvider,
  useToast,
  useToasts,
} from './ToastContext';

export {
  DocumentProvider,
  useDocuments,
} from './DocumentContext';

export {
  AuthProvider,
  useAuth,
} from './AuthContext';

export type { SettingsContextValue } from './SettingsContext';
export type { Toast, ToastType } from './ToastContext';
export type { DocumentContextValue, DocumentMetadata, UploadProgress } from './DocumentContext';

export { AgentProvider, useAgent } from './AgentContext';
export type { AgentTask, AgentStep, AgentTaskStatus } from './AgentContext';

export { SkillProvider, useSkill } from './SkillContext';
export type { Skill, SkillDefinition, SkillScope } from './SkillContext';
