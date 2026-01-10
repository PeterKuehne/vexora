/**
 * Components - React UI Components
 * Central export point for all components
 */

// Chat components
export { ChatContainer } from './ChatContainer';
export { ChatInput } from './ChatInput';
export { MessageBubble } from './MessageBubble';

// Layout components
export { ConversationSidebar } from './ConversationSidebar';
export {
  AppShell,
  AppShellHeaderSection,
  AppShellSidebar,
  AppShellContent,
  Header,
  HeaderDivider,
  HeaderSection,
  type SidebarControls,
} from './layout';

// Error components
export { OllamaConnectionError } from './OllamaConnectionError';

// Status components
export { SaveIndicator } from './SaveIndicator';

// Branding components
export { Logo, LogoIcon, type LogoProps, type LogoSize, type LogoIconProps } from './Logo';

// Markdown rendering
export { Markdown, MarkdownInline, type MarkdownProps, type MarkdownInlineProps } from './Markdown';

// Code highlighting
export {
  CodeBlock,
  CodeBlockWrapper,
  extractLanguageFromClassName,
  detectLanguage,
  type CodeBlockProps,
  type CodeBlockWrapperProps,
} from './CodeBlock';

// Toast components
export { Toast, ToastContainer } from './Toast';

// Model selector
export {
  ModelSelector,
  ModelSelectorCompact,
  type ModelSelectorProps,
  type ModelSelectorCompactProps,
  type Model,
} from './ModelSelector';

// Theme toggle
export {
  ThemeToggle,
  ThemeToggleIcon,
  ThemeTogglePill,
  type ThemeToggleProps,
  type ThemeToggleIconProps,
  type ThemeTogglePillProps,
} from './ThemeToggle';

// Settings button
export {
  SettingsButton,
  SettingsButtonIcon,
  type SettingsButtonProps,
} from './SettingsButton';
export type { SettingsButtonIconProps } from './SettingsButton';

// Loading states
export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonMessage,
  SkeletonMessageList,
  SkeletonConversationItem,
  SkeletonConversationList,
} from './Skeleton';

export {
  Spinner,
  SpinnerOverlay,
  InlineSpinner,
  LoadingButtonContent,
} from './Spinner';
// export { Layout } from './Layout';
// export { ChatArea } from './ChatArea';

// UI components will be exported here
// export { Button } from './ui/Button';
// export { Input } from './ui/Input';
