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

// Toast components
export { Toast, ToastContainer } from './Toast';
// export { Layout } from './Layout';
// export { ChatArea } from './ChatArea';

// UI components will be exported here
// export { Button } from './ui/Button';
// export { Input } from './ui/Input';
