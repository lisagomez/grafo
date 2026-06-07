/**
 * Workspace Utility Functions
 */

/**
 * Generate unique workspace slug
 */
export const generateUniqueSlug = async (name, existingSlugs = []) => {
  let baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

/**
 * Calculate workspace storage usage
 */
export const calculateStorageUsage = (workspace) => {
  // In production, query actual storage
  return {
    used: 0,
    limit: getStorageLimit(workspace.plan),
    percentage: 0,
  };
};

/**
 * Get storage limit by plan
 */
export const getStorageLimit = (plan) => {
  const limits = {
    free: 1 * 1024 * 1024 * 1024, // 1GB
    basic: 5 * 1024 * 1024 * 1024, // 5GB
    pro: 100 * 1024 * 1024 * 1024, // 100GB
    enterprise: -1, // Unlimited
  };
  return limits[plan] || limits.free;
};

/**
 * Get member limit by plan
 */
export const getMemberLimit = (plan) => {
  const limits = {
    free: 3,
    basic: 5,
    pro: 25,
    enterprise: -1, // Unlimited
  };
  return limits[plan] || limits.free;
};

/**
 * Check if workspace can add more members
 */
export const canAddMembers = (workspace) => {
  const limit = getMemberLimit(workspace.plan);
  if (limit === -1) return true;
  return workspace.members.length < limit;
};

/**
 * Format workspace for API response
 */
export const formatWorkspace = (workspace, currentUserId) => {
  const currentMember = workspace.members.find(m => m.userId === currentUserId);
  
  return {
    ...workspace,
    role: currentMember?.role || 'member',
    memberCount: workspace.members.length,
    canManage: ['owner', 'admin'].includes(currentMember?.role),
  };
};

export default {
  generateUniqueSlug,
  calculateStorageUsage,
  getStorageLimit,
  getMemberLimit,
  canAddMembers,
  formatWorkspace,
};

