/**
 * Components - React UI Components
 * Central export point for all components
 */

// Chat components
export { ChatContainer } from './ChatContainer';
export { ChatInput } from './ChatInput';
export { MessageBubble } from './MessageBubble';

// Chat Textarea
export {
  ChatTextarea,
  ChatTextareaStandalone,
  ChatTextareaWithControls,
  type ChatTextareaProps,
  type ChatTextareaRef,
  type ChatTextareaStandaloneProps,
  type ChatTextareaWithControlsProps,
} from './ChatTextarea';

// Message List
export {
  MessageList,
  MessageListItem,
  MessageListLoadingIndicator,
  MessageListEmptyState,
  type MessageListProps,
  type MessageListRef,
  type MessageListItemProps,
  type MessageListLoadingIndicatorProps,
  type MessageListEmptyStateProps,
} from './MessageList';

// User Message
export {
  UserMessage,
  UserMessageCompact,
  UserMessageBubble,
  type UserMessageProps,
  type UserMessageCompactProps,
  type UserMessageBubbleProps,
} from './UserMessage';

// AI Message
export {
  AIMessage,
  AIMessageCompact,
  AIMessageBubble,
  AIMessageStreaming,
  type AIMessageProps,
  type AIMessageCompactProps,
  type AIMessageBubbleProps,
  type AIMessageStreamingProps,
} from './AIMessage';

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

// Storage Quota components
export {
  StorageQuotaAlert,
  StorageQuotaAlertCompact,
  StorageQuotaDebug,
  type StorageQuotaAlertProps,
} from './StorageQuotaAlert';

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

// Inline Code
export {
  InlineCode,
  InlineCodePrimary,
  InlineCodeSuccess,
  InlineCodeWarning,
  InlineCodeError,
  InlineCodePlain,
  type InlineCodeProps,
} from './InlineCode';

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

// Settings modal
export {
  SettingsModal,
  SettingsModalCompact,
  type SettingsModalProps,
  type SettingsModalCompactProps,
} from './SettingsModal';

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

// New Chat Button
export {
  NewChatButton,
  NewChatButtonIcon,
  NewChatFAB,
  type NewChatButtonProps,
  type NewChatButtonIconProps,
  type NewChatFABProps,
} from './NewChatButton';

// Conversation List
export {
  ConversationList,
  ConversationItem,
  type ConversationListProps,
  type ConversationItemProps,
} from './ConversationList';

// Conversation Group
export {
  ConversationGroup,
  ConversationGroupHeader,
  ConversationGroupCompact,
  ConversationGroupStatic,
  type ConversationGroupProps,
  type ConversationGroupHeaderProps,
  type DateGroupType,
} from './ConversationGroup';

// Search Input
export {
  SearchInput,
  SearchInputCompact,
  SearchInputWithResults,
  type SearchInputProps,
  type SearchInputRef,
  type SearchInputCompactProps,
  type SearchInputWithResultsProps,
  type SearchResult,
} from './SearchInput';

// Conversation Search
export {
  ConversationSearch,
  ConversationSearchCompact,
  ConversationSearchBar,
  type ConversationSearchProps,
  type ConversationSearchCompactProps,
  type ConversationSearchBarProps,
} from './ConversationSearch';

// Send Button
export {
  SendButton,
  SendButtonIcon,
  StopButton,
  SendButtonWithLoading,
  type SendButtonProps,
  type SendButtonIconProps,
  type StopButtonProps,
  type SendButtonWithLoadingProps,
  type SendButtonSize,
  type SendButtonVariant,
} from './SendButton';

// Regenerate Button
export {
  RegenerateButton,
  RegenerateButtonIcon,
  RegenerateButtonCompact,
  type RegenerateButtonProps,
  type RegenerateButtonIconProps,
  type RegenerateButtonCompactProps,
} from './RegenerateButton';

// Typing Indicator
export {
  TypingIndicator,
  TypingDots,
  TypingPulse,
  TypingWave,
  TypingIndicatorWithAvatar,
  TypingIndicatorInline,
  TypingIndicatorBubble,
  type TypingIndicatorProps,
  type TypingIndicatorDotsProps,
  type TypingIndicatorWithAvatarProps,
  type TypingIndicatorInlineProps,
  type TypingIndicatorBubbleProps,
  type TypingIndicatorSize,
  type TypingIndicatorVariant,
} from './TypingIndicator';

// Copy Button
export {
  CopyButton,
  CopyButtonIcon,
  CopyButtonWithLabel,
  CopyButtonSmall,
  CopyButtonLarge,
  CopyButtonGhost,
  CopyButtonOutline,
  type CopyButtonProps,
} from './CopyButton';

// Welcome Screen
export {
  WelcomeScreen,
  WelcomeScreenCompact,
  WelcomeScreenMinimal,
  type WelcomeScreenProps,
  type ExamplePrompt,
  DEFAULT_EXAMPLE_PROMPTS,
} from './WelcomeScreen';

// export { Layout } from './Layout';
// export { ChatArea } from './ChatArea';

// Navigation components
export { NavigationLinks, NavigationDivider } from './NavigationLinks';

// Document Management components
export { DocumentUpload } from './DocumentUpload';
export { DocumentList } from './DocumentList';
export { DocumentSidebar } from './DocumentSidebar';
export { MainSidebar } from './MainSidebar';
export { SidebarTabs, type SidebarTab } from './SidebarTabs';

// RAG components
export { RAGToggle } from './RAGToggle';
export { RAGSources } from './RAGSources';
export { SourceDetailModal } from './SourceDetailModal';

// Authentication components
export { ProtectedRoute } from './ProtectedRoute';
export { UserMenu, UserMenuSkeleton, type UserMenuProps } from './UserMenu';

// UI components will be exported here
// export { Button } from './ui/Button';
// export { Input } from './ui/Input';
