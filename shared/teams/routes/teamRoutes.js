/**
 * Team Routes Module
 * Handles team invitations and member management
 */

import { Router } from 'express';

const router = Router();

// In-memory store for demo
const invites = new Map();

/**
 * Send team invite
 */
router.post('/workspaces/:workspaceId/invites', (req, res) => {
  const { email, role = 'member' } = req.body;
  const { workspaceId } = req.params;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const invite = {
    id: `inv_${Date.now()}`,
    workspaceId,
    email,
    role,
    invitedBy: req.user?.id || 'demo',
    token: Math.random().toString(36).substring(2),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  invites.set(invite.id, invite);

  // In production, send email invitation
  console.log(`📧 Invite sent to ${email}`);

  res.status(201).json({
    success: true,
    data: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
  });
});

/**
 * List pending invites
 */
router.get('/workspaces/:workspaceId/invites', (req, res) => {
  const { workspaceId } = req.params;
  const now = new Date();

  const pendingInvites = [];
  for (const invite of invites.values()) {
    if (invite.workspaceId === workspaceId && invite.expiresAt > now) {
      pendingInvites.push({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      });
    }
  }

  res.json({ success: true, data: pendingInvites });
});

/**
 * Cancel invite
 */
router.delete('/workspaces/:workspaceId/invites/:inviteId', (req, res) => {
  const { inviteId } = req.params;

  if (!invites.has(inviteId)) {
    return res.status(404).json({ error: 'Invite not found' });
  }

  invites.delete(inviteId);

  res.json({ success: true, message: 'Invite cancelled' });
});

/**
 * Accept invite
 */
router.post('/invites/:token/accept', (req, res) => {
  const { token } = req.params;

  let foundInvite = null;
  for (const invite of invites.values()) {
    if (invite.token === token) {
      foundInvite = invite;
      break;
    }
  }

  if (!foundInvite) {
    return res.status(404).json({ error: 'Invite not found or expired' });
  }

  if (foundInvite.expiresAt < new Date()) {
    invites.delete(foundInvite.id);
    return res.status(400).json({ error: 'Invite has expired' });
  }

  // In production, add user to workspace
  invites.delete(foundInvite.id);

  res.json({
    success: true,
    data: {
      workspaceId: foundInvite.workspaceId,
      role: foundInvite.role,
    },
  });
});

/**
 * Update member role
 */
router.patch('/workspaces/:workspaceId/members/:memberId', (req, res) => {
  const { role } = req.body;

  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // In production, update in database
  res.json({
    success: true,
    data: {
      memberId: req.params.memberId,
      role,
      updatedAt: new Date(),
    },
  });
});

/**
 * Remove member
 */
router.delete('/workspaces/:workspaceId/members/:memberId', (req, res) => {
  // In production, remove from database
  res.json({ success: true, message: 'Member removed' });
});

/**
 * Leave workspace
 */
router.post('/workspaces/:workspaceId/leave', (req, res) => {
  // In production, remove current user from workspace
  res.json({ success: true, message: 'Left workspace' });
});

export default router;

