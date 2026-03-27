import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  SettingsModal,
  ToastContainer,
  ProtectedRoute,
  ErrorBoundary,
  WorkspaceLayout,
  type WorkspaceSection,
} from './components';
import { AgentTaskSidebar } from './components/AgentTaskSidebar';
import { AgentTaskDetail } from './components/AgentTaskDetail';
import { LoginPage, AdminUsersPage, AdminSystemSettingsPage, AuditLogsPage, DocumentsPage, DocumentsPageEmbedded, ProfilePage } from './pages';
import {
  ThemeProvider,
  SettingsProvider,
  ToastProvider,
  DocumentProvider,
  AuthProvider,
  useAuth,
  useToast,
  useToasts,
} from './contexts';
import { AgentProvider } from './contexts/AgentContext';
import { SkillProvider } from './contexts/SkillContext';
import { SkillSidebar } from './components/SkillSidebar';
import { SkillDetail } from './components/SkillDetail';

function ChatApp() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const { user, logout } = useAuth();
  const toasts = useToasts();
  const { removeToast } = useToast();

  const renderContent = (activeSection: WorkspaceSection) => {
    if (activeSection === 'documents') {
      return <DocumentsPageEmbedded />;
    }

    if (activeSection === 'tasks') {
      return <AgentTaskDetail />;
    }

    if (activeSection === 'skills') {
      return <SkillDetail />;
    }

    return null;
  };

  const tasksSidebar = <AgentTaskSidebar />;
  const skillsSidebar = <SkillSidebar />;

  return (
    <>
      <WorkspaceLayout
        tasksSidebar={tasksSidebar}
        skillsSidebar={skillsSidebar}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        userName={user?.name || user?.email}
        onLogout={logout}
      >
        {renderContent}
      </WorkspaceLayout>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/tasks"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <DocumentProvider>
                <AgentProvider>
                  <SkillProvider>
                    <ChatApp />
                  </SkillProvider>
                </AgentProvider>
              </DocumentProvider>
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/documents"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <DocumentProvider>
                <DocumentsPage />
              </DocumentProvider>
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="Admin">
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute requiredRole="Admin">
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute requiredRole="Admin">
            <AdminSystemSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/tasks" replace />} />
      <Route path="/chat" element={<Navigate to="/tasks" replace />} />
      <Route path="*" element={<Navigate to="/tasks" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
