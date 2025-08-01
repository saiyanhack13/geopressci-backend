/**
 * Role-based access control (RBAC) configuration
 * Defines all available roles and their permissions
 */

// Available user roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PRESSING: 'pressing',
  CLIENT: 'client',  
  GUEST: 'guest'
};

// Available permissions
const PERMISSIONS = {
  // User management
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  
  // Pressing management
  PRESSINGS_READ: 'pressings:read',
  PRESSINGS_WRITE: 'pressings:write',
  PRESSINGS_APPROVE: 'pressings:approve',
  PRESSINGS_MANAGE: 'pressings:manage',
  
  // Admin management
  ADMINS_READ: 'admins:read',
  ADMINS_MANAGE: 'admins:manage',
  
  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  
  // Billing
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',
  
  // Reports
  REPORTS_VIEW: 'reports:view',
  
  // Notifications
  NOTIFICATIONS_SEND: 'notifications:send',
  
  // Promotions
  PROMOTIONS_MANAGE: 'promotions:manage',
  
  // Content
  CONTENT_MANAGE: 'content:manage'
};

// Role definitions with their permissions
const rolePermissions = {
  [ROLES.SUPER_ADMIN]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.PRESSINGS_READ,
    PERMISSIONS.PRESSINGS_WRITE,
    PERMISSIONS.PRESSINGS_APPROVE,
    PERMISSIONS.PRESSINGS_MANAGE,
    PERMISSIONS.ADMINS_READ,
    PERMISSIONS.ADMINS_MANAGE,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_WRITE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROMOTIONS_MANAGE,
    PERMISSIONS.CONTENT_MANAGE
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.PRESSINGS_READ,
    PERMISSIONS.PRESSINGS_APPROVE,
    PERMISSIONS.ADMINS_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROMOTIONS_MANAGE
  ],
  [ROLES.PRESSING]: [
    PERMISSIONS.PRESSINGS_READ,
    PERMISSIONS.PRESSINGS_WRITE,
    PERMISSIONS.BILLING_READ
  ],
  [ROLES.CLIENT]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE
  ],
  [ROLES.GUEST]: []
};

// Helper function to check if a role has a specific permission
const hasPermission = (role, permission) => {
  if (!rolePermissions[role]) {
    return false;
  }
  return rolePermissions[role].includes(permission);
};

// Helper function to get all permissions for a role
const getRolePermissions = (role) => {
  return rolePermissions[role] || [];
};

module.exports = {
  ROLES,
  PERMISSIONS,
  rolePermissions,
  hasPermission,
  getRolePermissions
};
