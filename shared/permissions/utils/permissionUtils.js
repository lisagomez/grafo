/**
 * Permission Utility Functions
 */

// All available permissions
export const ALL_PERMISSIONS = [
  // Workspace
  { id: 'workspace:read', name: 'View Workspace', category: 'Workspace' },
  { id: 'workspace:update', name: 'Update Workspace', category: 'Workspace' },
  { id: 'workspace:delete', name: 'Delete Workspace', category: 'Workspace' },
  
  // Members
  { id: 'members:read', name: 'View Members', category: 'Members' },
  { id: 'members:invite', name: 'Invite Members', category: 'Members' },
  { id: 'members:remove', name: 'Remove Members', category: 'Members' },
  { id: 'members:update', name: 'Update Member Roles', category: 'Members' },
  
  // Billing
  { id: 'billing:read', name: 'View Billing', category: 'Billing' },
  { id: 'billing:update', name: 'Manage Billing', category: 'Billing' },
  
  // Projects
  { id: 'projects:read', name: 'View Projects', category: 'Projects' },
  { id: 'projects:create', name: 'Create Projects', category: 'Projects' },
  { id: 'projects:update', name: 'Update Projects', category: 'Projects' },
  { id: 'projects:delete', name: 'Delete Projects', category: 'Projects' },
  
  // Settings
  { id: 'settings:read', name: 'View Settings', category: 'Settings' },
  { id: 'settings:update', name: 'Update Settings', category: 'Settings' },
];

/**
 * Get permissions grouped by category
 */
export const getPermissionsByCategory = () => {
  return ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});
};

/**
 * Validate permission string
 */
export const isValidPermission = (permission) => {
  if (permission === '*') return true;
  if (permission.endsWith(':*')) {
    const category = permission.slice(0, -2);
    return ALL_PERMISSIONS.some(p => p.id.startsWith(category + ':'));
  }
  return ALL_PERMISSIONS.some(p => p.id === permission);
};

/**
 * Expand wildcard permissions
 */
export const expandPermissions = (permissions) => {
  const expanded = new Set();

  for (const perm of permissions) {
    if (perm === '*') {
      ALL_PERMISSIONS.forEach(p => expanded.add(p.id));
    } else if (perm.endsWith(':*')) {
      const prefix = perm.slice(0, -1);
      ALL_PERMISSIONS
        .filter(p => p.id.startsWith(prefix))
        .forEach(p => expanded.add(p.id));
    } else {
      expanded.add(perm);
    }
  }

  return Array.from(expanded);
};

/**
 * Compare two permission sets
 */
export const comparePermissions = (permissionsA, permissionsB) => {
  const expandedA = new Set(expandPermissions(permissionsA));
  const expandedB = new Set(expandPermissions(permissionsB));

  const added = [...expandedB].filter(p => !expandedA.has(p));
  const removed = [...expandedA].filter(p => !expandedB.has(p));
  const unchanged = [...expandedA].filter(p => expandedB.has(p));

  return { added, removed, unchanged };
};

export default {
  ALL_PERMISSIONS,
  getPermissionsByCategory,
  isValidPermission,
  expandPermissions,
  comparePermissions,
};

