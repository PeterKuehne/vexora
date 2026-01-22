/**
 * QuotaService - User Storage Quota Management
 *
 * Features:
 * - Role-based quota limits (Employee: 100MB, Manager: 500MB, Admin: 10GB)
 * - Real-time usage calculation from documents table
 * - Upload validation with quota enforcement
 * - Quota usage statistics and warnings
 */

import { databaseService } from './DatabaseService.js';

export interface QuotaLimits {
  employee: number;  // 100MB in bytes
  manager: number;   // 500MB in bytes
  admin: number;     // 10GB in bytes
}

export interface UserQuotaUsage {
  userId: string;
  userRole: string;
  usedBytes: number;
  usedMB: number;
  limitBytes: number;
  limitMB: number;
  availableBytes: number;
  availableMB: number;
  usagePercent: number;
  isWarning: boolean;     // > 80%
  isCritical: boolean;    // > 95%
  isExceeded: boolean;    // >= 100%
}

export interface QuotaValidationResult {
  allowed: boolean;
  reason?: string;
  currentUsage: UserQuotaUsage;
}

export class QuotaService {
  // Role-based quota limits in bytes
  private readonly quotaLimits: QuotaLimits = {
    employee: 100 * 1024 * 1024,    // 100MB
    manager: 500 * 1024 * 1024,     // 500MB
    admin: 10 * 1024 * 1024 * 1024  // 10GB
  };

  // Warning thresholds
  private readonly warningThreshold = 0.8;   // 80%
  private readonly criticalThreshold = 0.95; // 95%

  /**
   * Get user's current quota usage
   */
  async getUserQuotaUsage(userId: string, userRole: string): Promise<UserQuotaUsage> {
    await databaseService.initialize();

    // Calculate total file size for this user
    const result = await databaseService.query(
      `SELECT COALESCE(SUM(file_size), 0) as total_used
       FROM documents
       WHERE owner_id = $1 AND status = 'completed'`,
      [userId]
    );

    const usedBytes = parseInt(result.rows[0]?.total_used || '0');
    const limitBytes = this.getQuotaLimitForRole(userRole);

    const usedMB = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
    const limitMB = Math.round((limitBytes / (1024 * 1024)) * 100) / 100;
    const availableBytes = Math.max(0, limitBytes - usedBytes);
    const availableMB = Math.round((availableBytes / (1024 * 1024)) * 100) / 100;
    const usagePercent = limitBytes > 0 ? Math.round((usedBytes / limitBytes) * 1000) / 10 : 0;

    return {
      userId,
      userRole,
      usedBytes,
      usedMB,
      limitBytes,
      limitMB,
      availableBytes,
      availableMB,
      usagePercent,
      isWarning: usagePercent >= this.warningThreshold * 100,
      isCritical: usagePercent >= this.criticalThreshold * 100,
      isExceeded: usagePercent >= 100
    };
  }

  /**
   * Validate if user can upload a file of given size
   */
  async validateUpload(
    userId: string,
    userRole: string,
    fileSize: number
  ): Promise<QuotaValidationResult> {
    const currentUsage = await this.getUserQuotaUsage(userId, userRole);

    // Admin has unlimited quota
    if (userRole === 'admin') {
      return {
        allowed: true,
        currentUsage
      };
    }

    // Check if adding this file would exceed quota
    const wouldExceed = (currentUsage.usedBytes + fileSize) > currentUsage.limitBytes;

    if (wouldExceed) {
      return {
        allowed: false,
        reason: `Upload würde Ihr Speicher-Quota überschreiten. Benötigt: ${this.formatBytes(fileSize)}, Verfügbar: ${this.formatBytes(currentUsage.availableBytes)}`,
        currentUsage
      };
    }

    return {
      allowed: true,
      currentUsage
    };
  }

  /**
   * Get quota limit for role
   */
  private getQuotaLimitForRole(role: string): number {
    switch (role.toLowerCase()) {
      case 'admin':
        return this.quotaLimits.admin;
      case 'manager':
        return this.quotaLimits.manager;
      case 'employee':
      default:
        return this.quotaLimits.employee;
    }
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = Math.round((bytes / Math.pow(1024, i)) * 100) / 100;

    return `${size} ${sizes[i]}`;
  }

  /**
   * Get quota statistics for multiple users (Admin only)
   */
  async getQuotaStatistics(): Promise<{
    totalUsers: number;
    totalUsedBytes: number;
    totalUsedMB: number;
    averageUsagePercent: number;
    usersNearLimit: number;
    usersExceeded: number;
    usageByRole: {
      [role: string]: {
        userCount: number;
        totalUsedBytes: number;
        averageUsagePercent: number;
      };
    };
  }> {
    await databaseService.initialize();

    // Get usage by user and role
    const result = await databaseService.query(`
      SELECT
        u.role,
        u.id as user_id,
        COALESCE(SUM(d.file_size), 0) as used_bytes
      FROM users u
      LEFT JOIN documents d ON u.id = d.owner_id AND d.status = 'completed'
      WHERE u.is_active = true
      GROUP BY u.id, u.role
    `);

    const usageData = result.rows.map(row => {
      const limitBytes = this.getQuotaLimitForRole(row.role);
      const usagePercent = limitBytes > 0 ? (row.used_bytes / limitBytes) * 100 : 0;

      return {
        userId: row.user_id,
        role: row.role,
        usedBytes: parseInt(row.used_bytes),
        limitBytes,
        usagePercent
      };
    });

    const totalUsers = usageData.length;
    const totalUsedBytes = usageData.reduce((sum, user) => sum + user.usedBytes, 0);
    const totalUsedMB = Math.round((totalUsedBytes / (1024 * 1024)) * 100) / 100;
    const averageUsagePercent = totalUsers > 0
      ? Math.round((usageData.reduce((sum, user) => sum + user.usagePercent, 0) / totalUsers) * 10) / 10
      : 0;

    const usersNearLimit = usageData.filter(user => user.usagePercent >= 80).length;
    const usersExceeded = usageData.filter(user => user.usagePercent >= 100).length;

    // Group by role
    const usageByRole: any = {};
    for (const user of usageData) {
      if (!usageByRole[user.role]) {
        usageByRole[user.role] = {
          userCount: 0,
          totalUsedBytes: 0,
          averageUsagePercent: 0
        };
      }

      usageByRole[user.role].userCount++;
      usageByRole[user.role].totalUsedBytes += user.usedBytes;
    }

    // Calculate averages by role
    for (const role in usageByRole) {
      const roleData = usageByRole[role];
      const roleUsers = usageData.filter(user => user.role === role);
      roleData.averageUsagePercent = roleUsers.length > 0
        ? Math.round((roleUsers.reduce((sum, user) => sum + user.usagePercent, 0) / roleUsers.length) * 10) / 10
        : 0;
    }

    return {
      totalUsers,
      totalUsedBytes,
      totalUsedMB,
      averageUsagePercent,
      usersNearLimit,
      usersExceeded,
      usageByRole
    };
  }
}

export const quotaService = new QuotaService();