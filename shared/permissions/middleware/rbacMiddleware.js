/**
 * RBAC (Role-Based Access Control) Middleware
 */

// Default role permissions
const rolePermissions = {
  owner: ['*'],
  admin: [
    'workspace:read', 'workspace:update',
    'members:*',
    'billing:*',
    'projects:*',
    'settings:*',
  ],
  member: [
    'workspace:read',
    'members:read',
    'projects:read', 'projects:create', 'projects:update',
  ],
  viewer: [
    'workspace:read',
    'members:read',
    'projects:read',
  ],
};

/**
 * Check if user has permission (supports wildcards)
 */
export const hasPermission = (userPermissions, requiredPermission) => {
  for (const perm of userPermissions) {
    if (perm === '*') return true;
    if (perm === requiredPermission) return true;
    
    // Check wildcard patterns like "projects:*"
    if (perm.endsWith(':*')) {
      const prefix = perm.slice(0, -1);
      if (requiredPermission.startsWith(prefix)) return true;
    }
  }
  return false;
};

/**
 * Get permissions for a role
 */
export const getPermissionsForRole = (role) => {
  return rolePermissions[role] || rolePermissions.viewer;
};

/**
 * Middleware factory to require specific permission
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's role in current workspace
    const role = req.user.workspaceRole || req.user.role || 'viewer';
    const permissions = getPermissionsForRole(role);

    if (!hasPermission(permissions, permission)) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: permission,
      });
    }

    next();
  };
};

/**
 * Middleware factory to require any of the specified permissions
 */
export const requireAnyPermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = req.user.workspaceRole || req.user.role || 'viewer';
    const userPermissions = getPermissionsForRole(role);

    const hasAny = requiredPermissions.some(perm => 
      hasPermission(userPermissions, perm)
    );

    if (!hasAny) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: requiredPermissions,
      });
    }

    next();
  };
};

/**
 * Middleware factory to require all specified permissions
 */
export const requireAllPermissions = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = req.user.workspaceRole || req.user.role || 'viewer';
    const userPermissions = getPermissionsForRole(role);

    const hasAll = requiredPermissions.every(perm => 
      hasPermission(userPermissions, perm)
    );

    if (!hasAll) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: requiredPermissions,
      });
    }

    next();
  };
};

export default {
  hasPermission,
  getPermissionsForRole,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
};

