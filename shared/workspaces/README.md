# 🏢 Workspaces Module (Multi-Tenancy)

This module provides multi-tenant workspace functionality for SaaS applications where users can have multiple isolated workspaces.

## 📦 Dependencies

No additional dependencies required beyond the base project.

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Workspaces Configuration
MAX_WORKSPACES_PER_USER=5
DEFAULT_WORKSPACE_NAME=My Workspace
```

## 📁 Files Added

```
your-project/
├── frontend/
│   └── app/dashboard/workspaces/page.tsx
├── backend/
│   └── routes/workspaces.js
└── shared/workspaces/
    ├── middleware/workspaceMiddleware.js
    ├── routes/workspaceRoutes.js
    └── utils/workspaceUtils.js
```

## 🚀 Usage

### Backend Integration (Express)

```javascript
// In your main server file
import workspaceRoutes from './routes/workspaces.js';
import { authMiddleware } from './middleware/auth.js';
import { workspaceMiddleware } from './middleware/workspace.js';

// Workspace routes (requires auth)
app.use('/api/workspaces', authMiddleware, workspaceRoutes);

// Routes that require workspace context
app.use('/api/projects', authMiddleware, workspaceMiddleware, projectRoutes);
```

### Backend Integration (FastAPI)

```python
from app.routers import workspaces

app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"])
```

### Frontend Integration

The workspaces page is automatically available at:
- `/dashboard/workspaces` - Workspace management page

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces` | List user's workspaces |
| POST | `/api/workspaces` | Create new workspace |
| GET | `/api/workspaces/:id` | Get workspace details |
| PUT | `/api/workspaces/:id` | Update workspace |
| DELETE | `/api/workspaces/:id` | Delete workspace |
| POST | `/api/workspaces/:id/switch` | Switch active workspace |
| GET | `/api/workspaces/current` | Get current workspace |

## 🗄️ Database Schema (Prisma)

```prisma
model Workspace {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  logo        String?
  
  ownerId     String
  owner       User     @relation("OwnedWorkspaces", fields: [ownerId], references: [id])
  
  members     WorkspaceMember[]
  
  // Add your workspace-scoped models here
  projects    Project[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  role        String   @default("member") // owner, admin, member
  
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  
  joinedAt    DateTime  @default(now())
  
  @@unique([workspaceId, userId])
}

model User {
  id                  String   @id @default(cuid())
  // ... other fields
  
  currentWorkspaceId  String?  // Track active workspace
  
  ownedWorkspaces     Workspace[] @relation("OwnedWorkspaces")
  workspaceMemberships WorkspaceMember[]
}

// Example workspace-scoped model
model Project {
  id          String    @id @default(cuid())
  name        String
  
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  
  createdAt   DateTime  @default(now())
}
```

## 📝 Example: Workspace Middleware

```javascript
// middleware/workspace.js
export const workspaceMiddleware = async (req, res, next) => {
  const workspaceId = req.headers['x-workspace-id'] || req.user.currentWorkspaceId;
  
  if (!workspaceId) {
    return res.status(400).json({ error: 'No workspace selected' });
  }
  
  // Verify user is a member of this workspace
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: req.user.id,
      },
    },
    include: { workspace: true },
  });
  
  if (!member) {
    return res.status(403).json({ error: 'Not a member of this workspace' });
  }
  
  req.workspace = member.workspace;
  req.workspaceMember = member;
  next();
};
```

## 📝 Example: Workspace-Scoped Queries

```javascript
// All queries should be scoped to the current workspace
router.get('/projects', workspaceMiddleware, async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { workspaceId: req.workspace.id },
  });
  
  res.json(projects);
});

router.post('/projects', workspaceMiddleware, async (req, res) => {
  const project = await prisma.project.create({
    data: {
      name: req.body.name,
      workspaceId: req.workspace.id, // Always scope to workspace
    },
  });
  
  res.json(project);
});
```

## 📝 Example: Frontend Workspace Switcher

```jsx
// components/WorkspaceSwitcher.tsx
'use client';

import { useState, useEffect } from 'react';

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    fetch('/api/workspaces')
      .then(res => res.json())
      .then(setWorkspaces);
      
    fetch('/api/workspaces/current')
      .then(res => res.json())
      .then(setCurrent);
  }, []);

  const switchWorkspace = async (workspaceId) => {
    await fetch(`/api/workspaces/${workspaceId}/switch`, {
      method: 'POST',
    });
    window.location.reload();
  };

  return (
    <select 
      value={current?.id} 
      onChange={(e) => switchWorkspace(e.target.value)}
    >
      {workspaces.map(ws => (
        <option key={ws.id} value={ws.id}>{ws.name}</option>
      ))}
    </select>
  );
}
```

## 🔒 Data Isolation

**Important**: Always filter queries by `workspaceId` to ensure data isolation:

```javascript
// ✅ Correct - scoped to workspace
const projects = await prisma.project.findMany({
  where: { workspaceId: req.workspace.id },
});

// ❌ Wrong - leaks data across workspaces
const projects = await prisma.project.findMany();
```

## ❓ Need Help?

- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)
- Open an issue for questions

