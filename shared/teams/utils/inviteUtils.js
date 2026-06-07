/**
 * Team Invitation Utility Functions
 */

import crypto from 'crypto';

/**
 * Generate secure invite token
 */
export const generateInviteToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate invite expiry date
 */
export const getInviteExpiry = (days = 7) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
};

/**
 * Check if invite is expired
 */
export const isInviteExpired = (expiresAt) => {
  return new Date(expiresAt) < new Date();
};

/**
 * Format invite for API response
 */
export const formatInvite = (invite) => ({
  id: invite.id,
  email: invite.email,
  role: invite.role,
  expiresAt: invite.expiresAt,
  createdAt: invite.createdAt,
  status: isInviteExpired(invite.expiresAt) ? 'expired' : 'pending',
});

/**
 * Generate invite email content
 */
export const generateInviteEmail = ({ 
  workspaceName, 
  inviterName, 
  inviteUrl,
  role 
}) => {
  return {
    subject: `You've been invited to join ${workspaceName}`,
    text: `
${inviterName} has invited you to join ${workspaceName} as a ${role}.

Click the link below to accept the invitation:
${inviteUrl}

This invitation will expire in 7 days.
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #0ea5e9; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px;
      margin: 20px 0;
    }
    .footer { color: #666; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>You're invited!</h2>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> as a ${role}.</p>
    <a href="${inviteUrl}" class="button">Accept Invitation</a>
    <p class="footer">This invitation will expire in 7 days.</p>
  </div>
</body>
</html>
    `.trim(),
  };
};

/**
 * Validate email for invitation
 */
export const validateInviteEmail = (email, existingMembers = [], pendingInvites = []) => {
  const errors = [];

  // Check email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  // Check if already a member
  if (existingMembers.some(m => m.email === email)) {
    errors.push('User is already a member of this workspace');
  }

  // Check if invite already sent
  if (pendingInvites.some(i => i.email === email)) {
    errors.push('An invitation has already been sent to this email');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export default {
  generateInviteToken,
  getInviteExpiry,
  isInviteExpired,
  formatInvite,
  generateInviteEmail,
  validateInviteEmail,
};

