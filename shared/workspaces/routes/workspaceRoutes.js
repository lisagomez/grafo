/**
 * Workspace Routes Module
 * Handles workspace CRUD operations and membership
 */

import { Router } from 'express';

const router = Router();

// In-memory store for demo
const workspaces = new Map();

/**
 * Generate URL-friendly slug
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * List user's workspaces
 */
router.get('/', (req, res) => {
  const userId = req.user?.id || 'demo';
  const userWorkspaces = [];

  for (const workspace of workspaces.values()) {
    if (workspace.ownerId === userId || 
        workspace.members.some(m => m.userId === userId)) {
      userWorkspaces.push(workspace);
    }
  }

  res.json({ success: true, data: userWorkspaces });
});

/**
 * Create workspace
 */
router.post('/', (req, res) => {
  const { name } = req.body;
  const userId = req.user?.id || 'demo';

  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }

  const workspace = {
    id: `ws_${Date.now()}`,
    name,
    slug: generateSlug(name),
    ownerId: userId,
    plan: 'free',
    settings: {},
    members: [{ userId, role: 'owner', joinedAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  workspaces.set(workspace.id, workspace);

  res.status(201).json({ success: true, data: workspace });
});

/**
 * Get workspace by ID
 */
router.get('/:id', (req, res) => {
  const workspace = workspaces.get(req.params.id);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  res.json({ success: true, data: workspace });
});

/**
 * Update workspace
 */
router.patch('/:id', (req, res) => {
  const workspace = workspaces.get(req.params.id);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const { name, settings } = req.body;

  if (name) {
    workspace.name = name;
    workspace.slug = generateSlug(name);
  }

  if (settings) {
    workspace.settings = { ...workspace.settings, ...settings };
  }

  workspace.updatedAt = new Date();
  workspaces.set(workspace.id, workspace);

  res.json({ success: true, data: workspace });
});

/**
 * Delete workspace
 */
router.delete('/:id', (req, res) => {
  const workspace = workspaces.get(req.params.id);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  workspaces.delete(workspace.id);

  res.json({ success: true, message: 'Workspace deleted' });
});

export default router;

