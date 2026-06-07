# 🛡️ Permissions Module (RBAC)

This module provides Role-Based Access Control (RBAC) for fine-grained permissions management.

## 📦 Dependencies

No additional dependencies required beyond the base project.

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Permissions Configuration
DEFAULT_USER_ROLE=member
SUPER_ADMIN_EMAIL=admin@yourapp.com
```

## 📁 Files Added

```
your-project/
├── backend/
│   └── routes/permissions.js
└── shared/permissions/
    ├── middleware/rbacMiddleware.js
    └── utils/permissionUtils.js
```

## 🚀 Usage

### Backend Integration (Express)

```javascript
// In your main server file
import permissionRoutes from './routes/permissions.js';
import { authMiddleware } from './middleware/auth.js';
import { requirePermission, requireRole } from './middleware/rbac.js';

// Permission management routes (admin only)
app.use('/api/permissions', authMiddleware, requireRole('admin'), permissionRoutes);

// Example: Protect routes with permissions
app.get('/api/users', 
  authMiddleware, 
  requirePermission('users:read'), 
  userController.list
);

app.post('/api/users', 
  authMiddleware, 
  requirePermission('users:create'), 
  userController.create
);
```

### Backend Integration (FastAPI)

```python
from app.routers import permissions
from app.middleware.rbac import require_permission

app.include_router(permissions.router, prefix="/api/permissions", tags=["permissions"])

# Use as dependency
@app.get("/api/users")
async def list_users(user = Depends(require_permission("users:read"))):
    pass
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/permissions/roles` | List all roles |
| POST | `/api/permissions/roles` | Create new role |
| PUT | `/api/permissions/roles/:id` | Update role |
| DELETE | `/api/permissions/roles/:id` | Delete role |
| GET | `/api/permissions/roles/:id/permissions` | Get role permissions |
| PUT | `/api/permissions/roles/:id/permissions` | Update role permissions |
| PUT | `/api/permissions/users/:id/role` | Assign role to user |

## 🎯 Permission Format

Permissions follow the format: `resource:action`

### Common Resources
- `users` - User management
- `teams` - Team management
- `projects` - Project management
- `billing` - Billing & subscriptions
- `settings` - Application settings

### Common Actions
- `read` - View/list resources
- `create` - Create new resources
- `update` - Modify existing resources
- `delete` - Remove resources
- `manage` - Full access (wildcard)

### Examples
```
users:read        # Can view users
users:create      # Can create users
users:*           # Full access to users
projects:read     # Can view projects
*:read            # Can read all resources
*:*               # Super admin access
```

## 📋 Default Roles

```javascript
const DEFAULT_ROLES = {
  admin: {
    name: 'Admin',
    permissions: ['*:*'], // Full access
  },
  manager: {
    name: 'Manager',
    permissions: [
      'users:read',
      'users:create',
      'users:update',
      'teams:*',
      'projects:*',
    ],
  },
  member: {
    name: 'Member',
    permissions: [
      'users:read',
      'projects:read',
      'projects:create',
      'projects:update',
    ],
  },
  viewer: {
    name: 'Viewer',
    permissions: [
      '*:read', // Read-only access to everything
    ],
  },
};
```

## 🗄️ Database Schema (Prisma)

```prisma
model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  permissions String[] // Array of permission strings
  isSystem    Boolean  @default(false) // Prevent deletion of system roles
  
  users       User[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model User {
  id     String  @id @default(cuid())
  // ... other fields
  
  roleId String?
  role   Role?   @relation(fields: [roleId], references: [id])
}
```

## 📝 Example: RBAC Middleware

```javascript
// middleware/rbac.js
import { hasPermission, hasRole } from '../utils/permissionUtils.js';

export const requirePermission = (...permissions) => {
  return async (req, res, next) => {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(403).json({ error: 'No role assigned' });
    }
    
    const userPermissions = user.role.permissions;
    
    // Check if user has any of the required permissions
    const hasAccess = permissions.some(permission => 
      hasPermission(userPermissions, permission)
    );
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permissions,
      });
    }
    
    next();
  };
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.name;
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: roles,
      });
    }
    
    next();
  };
};
```

## 📝 Example: Permission Check Utility

```javascript
// utils/permissionUtils.js
export function hasPermission(userPermissions, requiredPermission) {
  // Check for exact match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }
  
  // Check for wildcards
  const [resource, action] = requiredPermission.split(':');
  
  // Check for resource wildcard (e.g., users:*)
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }
  
  // Check for action wildcard (e.g., *:read)
  if (userPermissions.includes(`*:${action}`)) {
    return true;
  }
  
  // Check for super admin (e.g., *:*)
  if (userPermissions.includes('*:*')) {
    return true;
  }
  
  return false;
}
```

## 📝 Example: Frontend Permission Check

```jsx
// hooks/usePermission.ts
import { useUser } from './useUser';

export function usePermission(permission: string): boolean {
  const { user } = useUser();
  
  if (!user?.role?.permissions) return false;
  
  return hasPermission(user.role.permissions, permission);
}

// Usage in component
function AdminPanel() {
  const canManageUsers = usePermission('users:manage');
  
  if (!canManageUsers) {
    return <AccessDenied />;
  }
  
  return <UserManagement />;
}
```

## 📝 Example: Conditional UI Rendering

```jsx
// components/PermissionGate.tsx
export function PermissionGate({ 
  permission, 
  children, 
  fallback = null 
}) {
  const hasAccess = usePermission(permission);
  
  if (!hasAccess) return fallback;
  
  return children;
}

// Usage
<PermissionGate permission="users:delete">
  <DeleteUserButton />
</PermissionGate>
```

## ❓ Need Help?

- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)
- Open an issue for questions

