/**
 * Admin Users Management Page
 * Allows administrators to view, edit, and manage all users
 */

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { AdminPageHeader } from '../components';
import type { User, UserRole } from '../types/auth';
import type { UserManagementResponse } from '../lib/api';
import { fetchAllUsers, updateUser } from '../lib/api';
import { DEPARTMENT_OPTIONS, ROLE_DESCRIPTIONS } from '../types/auth';

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    usersByRole: {} as Record<string, number>,
    usersByDepartment: {} as Record<string, number>,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'Employee' as UserRole,
    department: '',
    is_active: true,
  });

  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const isDark = theme === 'dark';

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response: UserManagementResponse = await fetchAllUsers();
      setUsers(response.data.users);
      setStatistics(response.data.statistics);
    } catch (error) {
      console.error('Error loading users:', error);
      addToast('error', error instanceof Error ? error.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      role: user.role,
      department: user.department || '',
      is_active: user.is_active,
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditForm({
      name: '',
      role: 'Employee',
      department: '',
      is_active: true,
    });
  };

  const handleSaveEdit = async (userId: string) => {
    try {
      // Find the user being edited
      const userBeingEdited = users.find(u => u.id === userId);
      if (!userBeingEdited) {
        addToast('error', 'User not found');
        return;
      }

      // Check if this would violate admin minimum requirement
      const currentAdminCount = statistics.usersByRole.Admin || 0;
      const isCurrentlyAdmin = userBeingEdited.role === 'Admin' && userBeingEdited.is_active;
      const wouldRemoveAdmin =
        (editForm.role !== 'Admin' && userBeingEdited.role === 'Admin') ||
        (!editForm.is_active && userBeingEdited.is_active && userBeingEdited.role === 'Admin');

      if (isCurrentlyAdmin && wouldRemoveAdmin && currentAdminCount <= 1) {
        addToast('error', 'Mindestens ein Admin muss immer im System existieren. Diese Änderung würde den letzten Admin entfernen.');
        return;
      }

      const updates: {
        name: string;
        role: UserRole;
        department?: string;
        is_active: boolean;
      } = {
        name: editForm.name,
        role: editForm.role,
        is_active: editForm.is_active,
      };

      // Only include department if it's not empty
      if (editForm.department && editForm.department.trim() !== '') {
        updates.department = editForm.department;
      }

      const response = await updateUser(userId, updates);

      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? response.data.user : user
        )
      );

      setEditingUserId(null);
      addToast('success', 'User updated successfully');

      // Reload statistics
      await loadUsers();

    } catch (error) {
      console.error('Error updating user:', error);
      addToast('error', error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className={`
        min-h-screen flex items-center justify-center
        transition-colors duration-150
        ${isDark ? 'bg-background' : 'bg-white'}
      `}>
        <div className={`
          flex items-center space-x-3
          px-6 py-4 rounded-lg
          transition-colors duration-150
          ${isDark
            ? 'text-gray-300 bg-surface/50'
            : 'text-gray-600 bg-white/50'
          }
        `}>
          <div className={`
            w-5 h-5 border-2 border-t-transparent rounded-full animate-spin
            transition-colors duration-150
            ${isDark ? 'border-gray-400' : 'border-gray-500'}
          `} />
          <span className="text-sm font-medium">Lade Benutzer...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      min-h-screen
      transition-colors duration-150
      ${isDark ? 'bg-background' : 'bg-white'}
    `}>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* Header with Back Button */}
        <AdminPageHeader
          title="Benutzerverwaltung"
          subtitle="Verwalten Sie Benutzerkonten, Rollen und Berechtigungen"
          icon={<Users size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
        />

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-blue-400' : 'text-blue-600'}
            `}>
              {statistics.totalUsers}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Gesamt
            </div>
          </div>

          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-green-400' : 'text-green-600'}
            `}>
              {statistics.activeUsers}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Aktiv
            </div>
          </div>

          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-purple-400' : 'text-purple-600'}
            `}>
              {statistics.usersByRole.Admin || 0}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Admins
            </div>
          </div>

          <div className={`
            p-6 rounded-lg border
            transition-colors duration-150
            ${isDark
              ? 'bg-surface border-white/10'
              : 'bg-white border-gray-200'
            }
          `}>
            <div className={`
              text-2xl font-bold
              transition-colors duration-150
              ${isDark ? 'text-orange-400' : 'text-orange-600'}
            `}>
              {statistics.usersByRole.Manager || 0}
            </div>
            <div className={`
              text-sm font-medium
              transition-colors duration-150
              ${isDark ? 'text-gray-400' : 'text-gray-500'}
            `}>
              Manager
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className={`
          rounded-lg border overflow-hidden
          transition-colors duration-150
          ${isDark
            ? 'bg-surface border-white/10'
            : 'bg-white border-gray-200'
          }
        `}>
          <div className={`
            px-6 py-4 border-b
            transition-colors duration-150
            ${isDark ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <h2 className={`
              text-lg font-semibold
              transition-colors duration-150
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              Benutzer ({users.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={`
                transition-colors duration-150
                ${isDark ? 'bg-surface-secondary' : 'bg-gray-50'}
              `}>
                <tr>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Name
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Email
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Rolle
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Abteilung
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Status
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Erstellt
                  </th>
                  <th className={`
                    px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className={`
                divide-y
                transition-colors duration-150
                ${isDark ? 'divide-gray-700' : 'divide-gray-200'}
              `}>
                {users.map((user) => (
                  <tr key={user.id} className={`
                    transition-colors duration-150
                    ${isDark
                      ? 'hover:bg-white/5'
                      : 'hover:bg-gray-50'
                    }
                  `}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className={`
                            w-full px-3 py-1 text-sm rounded border
                            transition-colors duration-150
                            focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${isDark
                              ? 'bg-surface-secondary border-white/20 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                            }
                          `}
                        />
                      ) : (
                        <div className={`
                          text-sm font-medium
                          transition-colors duration-150
                          ${isDark ? 'text-white' : 'text-gray-900'}
                        `}>
                          {user.name}
                        </div>
                      )}
                    </td>
                    <td className={`
                      px-6 py-4 whitespace-nowrap text-sm
                      transition-colors duration-150
                      ${isDark ? 'text-gray-300' : 'text-gray-600'}
                    `}>
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <div className="space-y-1">
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                            className={`
                              px-3 py-1 text-sm rounded border
                              transition-colors duration-150
                              focus:outline-none focus:ring-2 focus:ring-blue-500
                              ${isDark
                                ? 'bg-surface-secondary border-white/20 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                              }
                            `}
                          >
                            <option value="Employee">Employee</option>
                            <option value="Manager">Manager</option>
                            <option value="Admin">Admin</option>
                          </select>
                          {/* Warning for last admin */}
                          {user.role === 'Admin' &&
                           user.is_active &&
                           (statistics.usersByRole.Admin || 0) <= 1 &&
                           (editForm.role !== 'Admin' || !editForm.is_active) && (
                            <div className={`
                              text-xs p-2 rounded border-l-4
                              transition-colors duration-150
                              ${isDark
                                ? 'bg-red-900/30 border-red-500 text-red-400'
                                : 'bg-red-50 border-red-400 text-red-700'
                              }
                            `}>
                              ⚠️ Letzter Admin! Diese Änderung wird blockiert.
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`
                          inline-flex px-2 py-1 text-xs font-semibold rounded-full
                          transition-colors duration-150
                          ${user.role === 'Admin'
                            ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                            : user.role === 'Manager'
                            ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                            : isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                          }
                        `}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <select
                          value={editForm.department}
                          onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                          className={`
                            px-3 py-1 text-sm rounded border
                            transition-colors duration-150
                            focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${isDark
                              ? 'bg-surface-secondary border-white/20 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                            }
                          `}
                        >
                          <option value="">-- Keine Abteilung --</option>
                          {DEPARTMENT_OPTIONS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`
                          text-sm
                          transition-colors duration-150
                          ${isDark ? 'text-gray-300' : 'text-gray-600'}
                        `}>
                          {user.department || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <div className="space-y-1">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editForm.is_active}
                              onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                              className="rounded focus:ring-blue-500"
                            />
                            <span className={`
                              text-sm
                              transition-colors duration-150
                              ${isDark ? 'text-gray-300' : 'text-gray-600'}
                            `}>
                              Aktiv
                            </span>
                          </label>
                          {/* Warning for last admin deactivation */}
                          {user.role === 'Admin' &&
                           user.is_active &&
                           (statistics.usersByRole.Admin || 0) <= 1 &&
                           !editForm.is_active && (
                            <div className={`
                              text-xs p-2 rounded border-l-4
                              transition-colors duration-150
                              ${isDark
                                ? 'bg-red-900/30 border-red-500 text-red-400'
                                : 'bg-red-50 border-red-400 text-red-700'
                              }
                            `}>
                              ⚠️ Deaktivierung des letzten Admins blockiert!
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`
                          inline-flex px-2 py-1 text-xs font-semibold rounded-full
                          transition-colors duration-150
                          ${user.is_active
                            ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                            : isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                          }
                        `}>
                          {user.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      )}
                    </td>
                    <td className={`
                      px-6 py-4 whitespace-nowrap text-sm
                      transition-colors duration-150
                      ${isDark ? 'text-gray-300' : 'text-gray-600'}
                    `}>
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingUserId === user.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSaveEdit(user.id)}
                            className={`
                              px-3 py-1 rounded text-xs font-medium
                              transition-all duration-150
                              focus:outline-none focus:ring-2 focus:ring-green-500
                              ${isDark
                                ? 'bg-green-600 text-white hover:bg-green-500'
                                : 'bg-green-600 text-white hover:bg-green-700'
                              }
                            `}
                          >
                            Speichern
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className={`
                              px-3 py-1 rounded text-xs font-medium
                              transition-all duration-150
                              focus:outline-none focus:ring-2 focus:ring-gray-500
                              ${isDark
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-blue-400 text-white hover:bg-blue-500'
                              }
                            `}
                          >
                            Abbrechen
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditClick(user)}
                          disabled={user.id === currentUser?.id}
                          className={`
                            px-3 py-1 rounded text-xs font-medium
                            transition-all duration-150
                            focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${user.id === currentUser?.id
                              ? isDark
                                ? 'bg-surface-secondary text-gray-500 cursor-not-allowed'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : isDark
                              ? 'bg-blue-600 text-white hover:bg-blue-500'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                            }
                          `}
                        >
                          {user.id === currentUser?.id ? 'Eigenes Konto' : 'Bearbeiten'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Descriptions */}
        <div className={`
          mt-8 p-6 rounded-lg border
          transition-colors duration-150
          ${isDark
            ? 'bg-surface border-white/10'
            : 'bg-white border-gray-200'
          }
        `}>
          <h3 className={`
            text-lg font-semibold mb-4
            transition-colors duration-150
            ${isDark ? 'text-white' : 'text-gray-900'}
          `}>
            Rollenbeschreibungen
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
              <div key={role} className={`
                p-4 rounded border
                transition-colors duration-150
                ${isDark
                  ? 'bg-surface-secondary border-white/20'
                  : 'bg-gray-50 border-gray-200'
                }
              `}>
                <h4 className={`
                  font-medium mb-2
                  transition-colors duration-150
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}>
                  {role}
                </h4>
                <p className={`
                  text-sm
                  transition-colors duration-150
                  ${isDark ? 'text-gray-400' : 'text-gray-600'}
                `}>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}