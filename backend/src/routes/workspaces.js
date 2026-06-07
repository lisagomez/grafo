/**
 * Workspaces Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, HttpErrors } from '../middleware/errorHandler.js';
import { authenticate, requireWorkspaceMember, requireWorkspaceAdmin } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

// Validation schemas
const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  settings: z.object({}).passthrough().optional(),
});

// In-memory workspace store for demo
const workspaces = new Map();

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /workspaces
 * List all workspaces for current user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userWorkspaces = [];
  
  for (const workspace of workspaces.values()) {
    if (workspace.ownerId === req.user.id || 
        workspace.members.some(m => m.userId === req.user.id)) {
      userWorkspaces.push(workspace);
    }
  }

  res.json({
    success: true,
    data: userWorkspaces,
  });
}));

/**
 * POST /workspaces
 * Create a new workspace
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  // Validate input
  const result = createWorkspaceSchema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { name } = result.data;

  // Check workspace limit
  let userWorkspaceCount = 0;
  for (const workspace of workspaces.values()) {
    if (workspace.ownerId === req.user.id) {
      userWorkspaceCount++;
    }
  }

  if (userWorkspaceCount >= config.workspaces.maxPerUser) {
    throw HttpErrors.badRequest(`Maximum ${config.workspaces.maxPerUser} workspaces allowed`);
  }

  // Create workspace
  const workspace = {
    id: `ws_${uuidv4()}`,
    name,
    slug: generateSlug(name),
    ownerId: req.user.id,
    plan: 'free',
    settings: {},
    members: [
      {
        userId: req.user.id,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  workspaces.set(workspace.id, workspace);

  res.status(201).json({
    success: true,
    data: workspace,
  });
}));

/**
 * GET /workspaces/:workspaceId
 * Get a specific workspace
 */
router.get('/:workspaceId', authenticate, requireWorkspaceMember, asyncHandler(async (req, res) => {
  const workspace = workspaces.get(req.params.workspaceId);

  if (!workspace) {
    throw HttpErrors.notFound('Workspace not found');
  }

  res.json({
    success: true,
    data: workspace,
  });
}));

/**
 * PATCH /workspaces/:workspaceId
 * Update a workspace
 */
router.patch('/:workspaceId', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  const workspace = workspaces.get(req.params.workspaceId);

  if (!workspace) {
    throw HttpErrors.notFound('Workspace not found');
  }

  // Validate input
  const result = updateWorkspaceSchema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { name, settings } = result.data;

  // Update workspace
  if (name) {
    workspace.name = name;
    workspace.slug = generateSlug(name);
  }
  if (settings) {
    workspace.settings = { ...workspace.settings, ...settings };
  }
  workspace.updatedAt = new Date();

  workspaces.set(workspace.id, workspace);

  res.json({
    success: true,
    data: workspace,
  });
}));

/**
 * DELETE /workspaces/:workspaceId
 * Delete a workspace
 */
router.delete('/:workspaceId', authenticate, asyncHandler(async (req, res) => {
  const workspace = workspaces.get(req.params.workspaceId);

  if (!workspace) {
    throw HttpErrors.notFound('Workspace not found');
  }

  // Only owner can delete
  if (workspace.ownerId !== req.user.id) {
    throw HttpErrors.forbidden('Only the workspace owner can delete it');
  }

  workspaces.delete(workspace.id);

  res.json({
    success: true,
    message: 'Workspace deleted successfully',
  });
}));

/**
 * GET /workspaces/:workspaceId/members
 * List workspace members
 */
router.get('/:workspaceId/members', authenticate, requireWorkspaceMember, asyncHandler(async (req, res) => {
  const workspace = workspaces.get(req.params.workspaceId);

  if (!workspace) {
    throw HttpErrors.notFound('Workspace not found');
  }

  res.json({
    success: true,
    data: workspace.members,
  });
}));

export default router;

