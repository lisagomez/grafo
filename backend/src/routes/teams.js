/**
 * Teams Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, HttpErrors } from '../middleware/errorHandler.js';
import { authenticate, requireWorkspaceMember, requireWorkspaceAdmin } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

// Validation schemas
const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'member']).default('member'),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
});

// In-memory invite store for demo
const invites = new Map();

/**
 * POST /teams/workspaces/:workspaceId/invites
 * Invite a new team member
 */
router.post('/workspaces/:workspaceId/invites', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  // Validate input
  const result = inviteSchema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { email, role } = result.data;
  const { workspaceId } = req.params;

  // Create invite
  const invite = {
    id: `inv_${uuidv4()}`,
    workspaceId,
    email,
    role,
    invitedBy: req.user.id,
    token: uuidv4(),
    expiresAt: new Date(Date.now() + config.teams.inviteExpiryDays * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  invites.set(invite.id, invite);

  // In production, send invitation email here
  console.log(`📧 Invitation email would be sent to ${email}`);

  res.status(201).json({
    success: true,
    data: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
  });
}));

/**
 * GET /teams/workspaces/:workspaceId/invites
 * List pending invites
 */
router.get('/workspaces/:workspaceId/invites', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspaceInvites = [];

  for (const invite of invites.values()) {
    if (invite.workspaceId === workspaceId && invite.expiresAt > new Date()) {
      workspaceInvites.push({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      });
    }
  }

  res.json({
    success: true,
    data: workspaceInvites,
  });
}));

/**
 * DELETE /teams/workspaces/:workspaceId/invites/:inviteId
 * Cancel an invite
 */
router.delete('/workspaces/:workspaceId/invites/:inviteId', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  const { inviteId } = req.params;
  const invite = invites.get(inviteId);

  if (!invite) {
    throw HttpErrors.notFound('Invite not found');
  }

  invites.delete(inviteId);

  res.json({
    success: true,
    message: 'Invite cancelled',
  });
}));

/**
 * POST /teams/invites/:token/accept
 * Accept an invitation
 */
router.post('/invites/:token/accept', authenticate, asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Find invite by token
  let foundInvite = null;
  for (const invite of invites.values()) {
    if (invite.token === token) {
      foundInvite = invite;
      break;
    }
  }

  if (!foundInvite) {
    throw HttpErrors.notFound('Invite not found or expired');
  }

  if (foundInvite.expiresAt < new Date()) {
    invites.delete(foundInvite.id);
    throw HttpErrors.badRequest('Invite has expired');
  }

  // In production, add user to workspace members
  console.log(`👤 User ${req.user.id} joined workspace ${foundInvite.workspaceId}`);

  // Remove invite after acceptance
  invites.delete(foundInvite.id);

  res.json({
    success: true,
    data: {
      workspaceId: foundInvite.workspaceId,
      role: foundInvite.role,
    },
  });
}));

/**
 * PATCH /teams/workspaces/:workspaceId/members/:memberId
 * Update a team member's role
 */
router.patch('/workspaces/:workspaceId/members/:memberId', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  // Validate input
  const result = updateMemberSchema.safeParse(req.body);
  if (!result.success) {
    throw HttpErrors.badRequest('Validation failed', result.error.errors);
  }

  const { role } = result.data;
  const { memberId } = req.params;

  // In production, update member role in database
  res.json({
    success: true,
    data: {
      memberId,
      role,
      updatedAt: new Date(),
    },
  });
}));

/**
 * DELETE /teams/workspaces/:workspaceId/members/:memberId
 * Remove a team member
 */
router.delete('/workspaces/:workspaceId/members/:memberId', authenticate, requireWorkspaceAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  // Cannot remove yourself if you're the owner
  // In production, implement proper ownership transfer

  // In production, remove member from database
  res.json({
    success: true,
    message: 'Member removed from workspace',
  });
}));

/**
 * POST /teams/workspaces/:workspaceId/leave
 * Leave a workspace
 */
router.post('/workspaces/:workspaceId/leave', authenticate, requireWorkspaceMember, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // In production, check if user is owner (owners must transfer ownership first)
  // Remove user from workspace members

  res.json({
    success: true,
    message: 'Successfully left workspace',
  });
}));

export default router;

