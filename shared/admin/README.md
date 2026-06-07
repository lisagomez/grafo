# 👑 Admin Dashboard Module

This module provides a complete admin panel for managing your SaaS application.

## 📦 Dependencies

No additional dependencies required.

## 📁 Files Added

```
your-project/
├── frontend/
│   └── app/
│       └── admin/
│           ├── layout.tsx
│           ├── page.tsx
│           ├── users/page.tsx
│           ├── analytics/page.tsx
│           ├── settings/page.tsx
│           ├── audit-logs/page.tsx
│           └── feature-flags/page.tsx
├── backend/
│   └── routes/admin.js
└── shared/admin/
    └── README.md
```

## 🔧 Environment Variables

```env
# Admin Configuration
ADMIN_EMAILS=admin@yourapp.com,superadmin@yourapp.com
ADMIN_ROLE=admin
```

## 🚀 Features

### User Management
- View all users
- Edit user details
- Change user roles
- Suspend/activate accounts
- Impersonate users
- Export user data

### System Analytics
- Active users chart
- Revenue metrics
- Signup trends
- Feature usage stats
- Error rates

### Audit Logs
- User actions
- System events
- Filter by date/action/user
- Export logs

### Feature Flags
- Toggle features
- A/B test management
- User targeting
- Gradual rollouts

### System Settings
- Email templates
- Notification settings
- API keys management
- Webhook configs

## 📝 Admin Layout

```tsx
// app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function AdminLayout({ children }) {
  const session = await getSession();
  
  // Check admin access
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-4">
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>
        <nav className="mt-4">
          <NavLink href="/admin" icon={Home}>Dashboard</NavLink>
          <NavLink href="/admin/users" icon={Users}>Users</NavLink>
          <NavLink href="/admin/analytics" icon={BarChart}>Analytics</NavLink>
          <NavLink href="/admin/audit-logs" icon={FileText}>Audit Logs</NavLink>
          <NavLink href="/admin/feature-flags" icon={Flag}>Features</NavLink>
          <NavLink href="/admin/settings" icon={Settings}>Settings</NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100">
        {children}
      </main>
    </div>
  );
}
```

## 📊 Admin Dashboard

```tsx
// app/admin/page.tsx
export default async function AdminDashboard() {
  const stats = await getAdminStats();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Users" value={stats.totalUsers} change="+12%" />
        <StatCard title="Active Today" value={stats.activeToday} change="+5%" />
        <StatCard title="MRR" value={formatCurrency(stats.mrr)} change="+8%" />
        <StatCard title="Churn Rate" value="2.3%" change="-0.5%" positive />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card title="User Growth">
          <LineChart data={stats.userGrowth} />
        </Card>
        <Card title="Revenue">
          <BarChart data={stats.revenue} />
        </Card>
      </div>

      {/* Recent Activity */}
      <Card title="Recent Activity" className="mt-6">
        <ActivityList activities={stats.recentActivities} />
      </Card>
    </div>
  );
}
```

## 👥 User Management

```tsx
// app/admin/users/page.tsx
'use client';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({});

  const handleImpersonate = async (userId: string) => {
    await fetch(`/api/admin/impersonate/${userId}`, { method: 'POST' });
    window.location.href = '/dashboard';
  };

  const handleSuspend = async (userId: string) => {
    await fetch(`/api/admin/users/${userId}/suspend`, { method: 'POST' });
    refetch();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex gap-4">
          <SearchInput value={search} onChange={setSearch} />
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'name', label: 'Name' },
          { key: 'role', label: 'Role' },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Joined' },
          { 
            key: 'actions', 
            label: '', 
            render: (user) => (
              <DropdownMenu>
                <MenuItem onClick={() => handleEdit(user.id)}>Edit</MenuItem>
                <MenuItem onClick={() => handleImpersonate(user.id)}>Impersonate</MenuItem>
                <MenuItem onClick={() => handleSuspend(user.id)} danger>
                  {user.suspended ? 'Activate' : 'Suspend'}
                </MenuItem>
              </DropdownMenu>
            )
          }
        ]}
        data={users}
      />
    </div>
  );
}
```

## 🔌 Admin API Routes

```javascript
// routes/admin.js
import { Router } from 'express';
import { adminMiddleware } from '../middleware/admin.js';

const router = Router();

// All routes require admin access
router.use(adminMiddleware);

// Dashboard stats
router.get('/stats', async (req, res) => {
  const stats = await getAdminStats();
  res.json(stats);
});

// Users
router.get('/users', async (req, res) => {
  const { page, limit, search, role, status } = req.query;
  const users = await prisma.user.findMany({
    where: {
      OR: search ? [
        { email: { contains: search } },
        { name: { contains: search } }
      ] : undefined,
      role: role || undefined,
      suspended: status === 'suspended'
    },
    skip: (page - 1) * limit,
    take: parseInt(limit)
  });
  res.json(users);
});

// Impersonate user
router.post('/impersonate/:userId', async (req, res) => {
  const { userId } = req.params;
  
  // Log impersonation
  await auditLog({
    action: 'impersonate',
    userId: req.user.id,
    targetUserId: userId
  });

  // Generate temp token for target user
  const token = generateToken({ userId, impersonatedBy: req.user.id });
  
  res.json({ token });
});

// Suspend user
router.post('/users/:userId/suspend', async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.userId },
    data: { suspended: true }
  });
  res.json({ success: true });
});

// Export users
router.get('/users/export', async (req, res) => {
  const users = await prisma.user.findMany();
  const csv = convertToCSV(users);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
  res.send(csv);
});

export default router;
```

## 🛡️ Admin Middleware

```javascript
// middleware/admin.js
export const adminMiddleware = async (req, res, next) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
  const isAdmin = user.role === 'admin' || adminEmails.includes(user.email);

  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};
```

## ❓ Need Help?

- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

