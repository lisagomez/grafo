# 📋 Audit Log Module

This module provides comprehensive audit logging for compliance and security.

## 📦 Dependencies

No additional dependencies required.

## 🔧 Environment Variables

```env
# Audit Log
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90
AUDIT_LOG_SENSITIVE_FIELDS=password,token,secret
```

## 📁 Files Added

```
your-project/
├── frontend/
│   └── app/
│       └── admin/
│           └── audit-logs/page.tsx
├── backend/
│   ├── routes/audit.js
│   └── middleware/auditLog.js
└── shared/audit-log/
    ├── lib/auditService.js
    └── README.md
```

## 🗄️ Database Schema (Prisma)

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  
  // Who
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  userEmail   String?
  userIp      String?
  userAgent   String?
  
  // What
  action      String   // 'create', 'update', 'delete', 'login', 'export'
  resource    String   // 'user', 'workspace', 'team', 'billing'
  resourceId  String?
  
  // Details
  description String?
  oldValue    Json?    // Previous state
  newValue    Json?    // New state
  changes     Json?    // Diff of changes
  metadata    Json?    // Additional context
  
  // When
  timestamp   DateTime @default(now())
  
  // Context
  workspaceId String?
  workspace   Workspace? @relation(fields: [workspaceId], references: [id])
  
  // Indexing
  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([timestamp])
  @@index([workspaceId])
}
```

## 🚀 Usage

### Audit Service

```javascript
// lib/auditService.js
import { prisma } from './prisma.js';

class AuditService {
  constructor() {
    this.sensitiveFields = (process.env.AUDIT_LOG_SENSITIVE_FIELDS || '')
      .split(',')
      .filter(Boolean);
  }

  /**
   * Log an action
   */
  async log({
    userId,
    userEmail,
    userIp,
    userAgent,
    action,
    resource,
    resourceId,
    description,
    oldValue,
    newValue,
    metadata,
    workspaceId
  }) {
    if (process.env.AUDIT_LOG_ENABLED !== 'true') {
      return null;
    }

    // Sanitize sensitive data
    const sanitizedOld = this.sanitize(oldValue);
    const sanitizedNew = this.sanitize(newValue);
    
    // Calculate changes
    const changes = this.calculateChanges(sanitizedOld, sanitizedNew);

    return prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        userIp,
        userAgent,
        action,
        resource,
        resourceId,
        description,
        oldValue: sanitizedOld,
        newValue: sanitizedNew,
        changes,
        metadata,
        workspaceId
      }
    });
  }

  /**
   * Remove sensitive fields from data
   */
  sanitize(data) {
    if (!data) return null;
    
    const sanitized = { ...data };
    
    for (const field of this.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Calculate changes between old and new values
   */
  calculateChanges(oldValue, newValue) {
    if (!oldValue || !newValue) return null;
    
    const changes = {};
    
    for (const key of Object.keys(newValue)) {
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changes[key] = {
          from: oldValue[key],
          to: newValue[key]
        };
      }
    }
    
    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Query audit logs
   */
  async query({
    userId,
    action,
    resource,
    resourceId,
    workspaceId,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  }) {
    const where = {};
    
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (workspaceId) where.workspaceId = workspaceId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    return { logs, total };
  }

  /**
   * Clean up old logs
   */
  async cleanup() {
    const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoffDate } }
    });

    return result.count;
  }
}

export const auditService = new AuditService();
export default auditService;
```

### Audit Middleware

```javascript
// middleware/auditLog.js
import { auditService } from '../lib/auditService.js';

/**
 * Middleware to automatically log API actions
 */
export function auditMiddleware(resource) {
  return async (req, res, next) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    let oldValue = null;

    // For update/delete, fetch the original value
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && req.params.id) {
      try {
        oldValue = await fetchResource(resource, req.params.id);
      } catch (e) {
        // Resource might not exist
      }
    }

    // Override res.json to capture response
    res.json = async function(data) {
      // Log the action after successful response
      if (res.statusCode < 400) {
        const action = getActionFromMethod(req.method);
        
        await auditService.log({
          userId: req.user?.id,
          userEmail: req.user?.email,
          userIp: req.ip,
          userAgent: req.headers['user-agent'],
          action,
          resource,
          resourceId: req.params.id || data?.id,
          oldValue,
          newValue: ['POST', 'PUT', 'PATCH'].includes(req.method) ? data : null,
          workspaceId: req.workspace?.id
        });
      }

      return originalJson(data);
    };

    next();
  };
}

function getActionFromMethod(method) {
  switch (method) {
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}
```

### Manual Logging

```javascript
// Log user login
await auditService.log({
  userId: user.id,
  userEmail: user.email,
  userIp: req.ip,
  action: 'login',
  resource: 'auth',
  description: 'User logged in successfully',
  metadata: { method: 'email' }
});

// Log data export
await auditService.log({
  userId: req.user.id,
  action: 'export',
  resource: 'users',
  description: 'Exported user data to CSV',
  metadata: { format: 'csv', recordCount: 150 }
});

// Log permission change
await auditService.log({
  userId: req.user.id,
  action: 'update',
  resource: 'user_role',
  resourceId: targetUser.id,
  description: `Changed role from ${oldRole} to ${newRole}`,
  oldValue: { role: oldRole },
  newValue: { role: newRole }
});
```

### Admin Audit Log Viewer

```tsx
// app/admin/audit-logs/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    setIsLoading(true);
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/admin/audit-logs?${params}`);
    const data = await response.json();
    setLogs(data.logs);
    setIsLoading(false);
  };

  const getActionBadge = (action) => {
    const colors = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      login: 'bg-purple-100 text-purple-800',
      export: 'bg-yellow-100 text-yellow-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
        <select 
          onChange={(e) => setFilters({...filters, action: e.target.value})}
          className="border rounded px-3 py-2"
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
        </select>
        <input
          type="date"
          onChange={(e) => setFilters({...filters, startDate: e.target.value})}
          className="border rounded px-3 py-2"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Action</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Resource</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img 
                      src={log.user?.avatar || '/default-avatar.png'} 
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm">{log.userEmail}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${getActionBadge(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {log.resource}
                  {log.resourceId && <span className="text-gray-400 ml-1">#{log.resourceId}</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {log.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## 🔒 Best Practices

1. **Don't log sensitive data** - Passwords, tokens, PII
2. **Set retention periods** - GDPR compliance
3. **Index appropriately** - Fast queries
4. **Monitor log size** - Storage management

## ❓ Need Help?

- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

