/**
 * Components - React UI Components
 * Central export point for all components
 */

// Chat input (used by Agent)
export { ChatInput } from './ChatInput';

// Layout components
export {
  AppShell,
  AppShellHeaderSection,
  AppShellSidebar,
  AppShellContent,
  Header,
  HeaderDivider,
  HeaderSection,
  type SidebarControls,
  // Workspace Layout
  WorkspaceLayout,
  IconRail,
  WorkspaceSidebar,
  type WorkspaceSection,
} from './layout';

// Error components
export { ErrorBoundary } from './ErrorBoundary';

// Status components
export { SaveIndicator } from './SaveIndicator';
export { TransparencyFooter, type TransparencyFooterProps } from './TransparencyFooter';

// Storage Quota components
export {
  StorageQuotaAlert,
  StorageQuotaAlertCompact,
  StorageQuotaDebug,
  type StorageQuotaAlertProps,
} from './StorageQuotaAlert';
export {
  StorageQuotaDisplay,
  type StorageQuotaDisplayProps,
} from './StorageQuotaDisplay';

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

// Navigation components
export { NavigationLinks, NavigationDivider } from './NavigationLinks';

// Document Management components
export { DocumentUpload } from './DocumentUpload';
export { DocumentList } from './DocumentList';
export { DocumentSidebar } from './DocumentSidebar';
export { SidebarTabs, type SidebarTab } from './SidebarTabs';
export { UploadModal } from './UploadModal';

// Authentication components
export { ProtectedRoute } from './ProtectedRoute';
export { UserMenu, UserMenuSkeleton, type UserMenuProps } from './UserMenu';

// Admin components
export { AdminPageHeader, type AdminPageHeaderProps } from './AdminPageHeader';
