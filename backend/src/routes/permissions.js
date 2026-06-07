/**
 * Permissions & RBAC Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpErrors } from '../middleware/errorHandler.js';
import { authenticate, requireWorkspaceAdmin } from '../middleware/auth.js';

const router = Router();

// Default roles and permissions
const defaultRoles = {
  owner: {
    name: 'Owner',
    description: 'Full access to all features',
    permissions: ['*'],
  },
  admin: {
    name: 'Admin',
    description: 'Manage workspace settings and members',
    permissions: [
      'workspace:read',
      'workspace:update',
      'members:read',
      'members:invite',
      'members:remove',
      'members:update',
      'billing:read',
      'billing:update',
      'projects:*',
    ],
  },
  member: {
    name: 'Member',
    description: 'Access to projects and basic features',
    permissions: [
      'workspace:read',
      'members:read',
      'projects:read',
      'projects:create',
      'projects:update',
    ],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'workspace:read',
      'members:read',
      'projects:read',
    ],
  },
};

// All available permissions
const allPermissions = [
  { id: 'workspace:read', name: 'View Workspace', category: 'Workspace' },
  { id: 'workspace:update', name: 'Update Workspace', category: 'Workspace' },
  { id: 'workspace:delete', name: 'Delete Workspace', category: 'Workspace' },
  { id: 'members:read', name: 'View Members', category: 'Members' },
  { id: 'members:invite', name: 'Invite Members', category: 'Members' },
  { id: 'members:remove', name: 'Remove Members', category: 'Members' },
  { id: 'members:update', name: 'Update Member Roles', category: 'Members' },
  { id: 'billing:read', name: 'View Billing', category: 'Billing' },
  { id: 'billing:update', name: 'Manage Billing', category: 'Billing' },
  { id: 'projects:read', name: 'View Projects', category: 'Projects' },
  { id: 'projects:create', name: 'Create Projects', category: 'Projects' },
  { id: 'projects:update', name: 'Update Projects', category: 'Projects' },
  { id: 'projects:delete', name: 'Delete Projects', category: 'Projects' },
];

// In-memory custom roles store
const customRoles = new Map();

/**
 * Check if a permission matches (supports wildcards)
 */
function hasPermission(userPermissions, requiredPermission) {
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
}

/**
 * GET /permissions/roles
 * List all available roles
 */
router.get('/roles', authenticate, asyncHandler(async (req, res) => {
  const roles = { ...defaultRoles };

  // Add custom roles for the user's workspace
  // In production, filter by workspace

  res.json({
    success: true,
    data: roles,
  });
}));

/**
 * GET /permissions/all
 * List all available permissions
 */
router.get('/all', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: allPermissions,
  });
}));

/**
 * GET /permissions/check
 * Check if current user has a specific permission
 */
router.get('/check', authenticate, asyncHandler(async (req, res) => {
  const { permission, workspaceId } = req.query;

  if (!permission) {
    throw HttpErrors.badRequest('Permission parameter required');
  }

  // In production, get user's role and permissions from database
  const userRole = 'member'; // Demo value
  const roleConfig = defaultRoles[userRole];
  
  if (!roleConfig) {
    throw HttpErrors.internal('Invalid role configuration');
  }

  const allowed = hasPermission(roleConfig.permissions, permission);

  res.json({
    success: true,
    data: {
      permission,
      allowed,
      role: userRole,
    },
  });
}));

/**
 * POST /permissions/workspaces/:workspaceId/roles
 * Create a custom role for a workspace
 */
router.post('/workspaces/:workspaceId/roles', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(50),
    description: z.string().max(200).optional(),
    permissions: z.array(z.string()).min(1),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { name, description, permissions } = result.data;
  const { workspaceId } = req.params;

  // Validate permissions exist
  const validPermissions = allPermissions.map(p => p.id);
  for (const perm of permissions) {
    if (!validPermissions.includes(perm) && perm !== '*' && !perm.endsWith(':*')) {
      throw HttpErrors.badRequest(`Invalid permission: ${perm}`);
    }
  }

  const roleId = `role_${name.toLowerCase().replace(/\s+/g, '_')}`;
  const customRole = {
    id: roleId,
    workspaceId,
    name,
    description: description || '',
    permissions,
    isCustom: true,
    createdAt: new Date(),
  };

  customRoles.set(roleId, customRole);

  res.status(201).json({
    success: true,
    data: customRole,
  });
}));

/**
 * PATCH /permissions/workspaces/:workspaceId/roles/:roleId
 * Update a custom role
 */
router.patch('/workspaces/:workspaceId/roles/:roleId', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const customRole = customRoles.get(roleId);

  if (!customRole) {
    throw HttpErrors.notFound('Role not found');
  }

  const schema = z.object({
    name: z.string().min(2).max(50).optional(),
    description: z.string().max(200).optional(),
    permissions: z.array(z.string()).min(1).optional(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { name, description, permissions } = result.data;

  if (name) customRole.name = name;
  if (description !== undefined) customRole.description = description;
  if (permissions) customRole.permissions = permissions;
  customRole.updatedAt = new Date();

  customRoles.set(roleId, customRole);

  res.json({
    success: true,
    data: customRole,
  });
}));

/**
 * DELETE /permissions/workspaces/:workspaceId/roles/:roleId
 * Delete a custom role
 */
router.delete('/workspaces/:workspaceId/roles/:roleId', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const customRole = customRoles.get(roleId);

  if (!customRole) {
    throw HttpErrors.notFound('Role not found');
  }

  // Check if role is in use before deleting
  // In production, check database for members using this role

  customRoles.delete(roleId);

  res.json({
    success: true,
    message: 'Role deleted successfully',
  });
}));

export default router;

