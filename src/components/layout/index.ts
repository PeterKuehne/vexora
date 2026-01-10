/**
 * Layout Components
 * App shell and layout-related components
 */

export {
  AppShell,
  AppShellHeaderSection,
  AppShellSidebar,
  AppShellContent,
  type AppShellProps,
  type AppShellHeaderSectionProps,
  type AppShellSidebarProps,
  type AppShellContentProps,
  type SidebarControls,
} from './AppShell';

export {
  Header,
  HeaderDivider,
  HeaderSection,
  type HeaderProps,
  type HeaderSectionProps,
} from './Header';

export {
  Sidebar,
  SidebarSection,
  SidebarItem,
  SidebarDivider,
  type SidebarProps,
  type SidebarSectionProps,
  type SidebarItemProps,
} from './Sidebar';

export {
  ChatArea,
  ChatAreaMessages,
  ChatAreaEmptyState,
  ChatAreaInputWrapper,
  ChatAreaStatusBar,
  type ChatAreaProps,
  type ChatAreaRef,
  type ChatAreaMessagesProps,
  type ChatAreaEmptyStateProps,
  type ChatAreaInputWrapperProps,
  type ChatAreaStatusBarProps,
} from './ChatArea';
