# 🔔 Notifications Module

This module provides in-app notifications with optional real-time updates.

## 📦 Dependencies

Add these to your `package.json`:

### Backend (Node.js/Express)
```json
{
  "dependencies": {
    "pusher": "^5.2.0"
  }
}
```

**OR** for Socket.io:
```json
{
  "dependencies": {
    "socket.io": "^4.7.4"
  }
}
```

### Frontend (Next.js)
```json
{
  "dependencies": {
    "pusher-js": "^8.4.0"
  }
}
```

**OR** for Socket.io:
```json
{
  "dependencies": {
    "socket.io-client": "^4.7.4"
  }
}
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Notifications
NOTIFICATION_PROVIDER=pusher  # or 'socketio', 'polling'

# Pusher
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=us2

# Socket.io (if using)
SOCKETIO_CORS_ORIGIN=http://localhost:3000
```

## 📁 Files Added

```
your-project/
├── frontend/
│   └── components/
│       ├── NotificationBell.tsx
│       ├── NotificationList.tsx
│       └── NotificationToast.tsx
├── backend/
│   └── routes/notifications.js
└── shared/notifications/
│   ├── lib/
│   │   ├── notificationService.js
│   │   └── providers/
│   │       ├── pusher.js
│   │       └── socketio.js
│   └── README.md
```

## 🗄️ Database Schema (Prisma)

```prisma
model Notification {
  id        String   @id @default(cuid())
  type      String   // 'info', 'success', 'warning', 'error'
  title     String
  message   String
  link      String?
  read      Boolean  @default(false)
  
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  createdAt DateTime @default(now())
  readAt    DateTime?
}
```

## 🚀 Usage

### Backend - Send Notification

```javascript
import { NotificationService } from './lib/notificationService.js';

const notificationService = new NotificationService();

// Send to user
await notificationService.send({
  userId: user.id,
  type: 'success',
  title: 'Payment received',
  message: 'Your payment of $99.00 has been processed.',
  link: '/dashboard/billing'
});

// Send to multiple users
await notificationService.sendBatch(userIds, {
  type: 'info',
  title: 'New feature released',
  message: 'Check out our new analytics dashboard!'
});
```

### Backend - API Routes

```javascript
// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(notifications);
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, async (req, res) => {
  await prisma.notification.update({
    where: { id: req.params.id, userId: req.user.id },
    data: { read: true, readAt: new Date() }
  });
  res.json({ success: true });
});

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true, readAt: new Date() }
  });
  res.json({ success: true });
});
```

### Frontend - Notification Bell Component

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import Pusher from 'pusher-js';

export function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Fetch initial notifications
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      });

    // Subscribe to real-time updates
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    });

    const channel = pusher.subscribe(`user-${userId}`);
    channel.bind('notification', (data) => {
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => pusher.disconnect();
  }, []);

  const markAsRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2">
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-gray-500 text-center">No notifications</p>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
              >
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm text-gray-600">{notification.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

### Notification Types

```javascript
const NOTIFICATION_TYPES = {
  // System notifications
  WELCOME: 'welcome',
  SYSTEM_UPDATE: 'system_update',
  
  // Team notifications
  TEAM_INVITE: 'team_invite',
  TEAM_MEMBER_JOINED: 'team_member_joined',
  TEAM_MEMBER_LEFT: 'team_member_left',
  
  // Billing notifications
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  
  // Activity notifications
  COMMENT_ADDED: 'comment_added',
  MENTIONED: 'mentioned',
  TASK_ASSIGNED: 'task_assigned'
};
```

## 📊 Provider Comparison

| Feature | Pusher | Socket.io | Polling |
|---------|--------|-----------|---------|
| Real-time | ✅ | ✅ | ❌ |
| Hosted | ✅ | ❌ | ❌ |
| Free Tier | 200K/day | ∞ | ∞ |
| Setup | Easy | Medium | Easy |
| Scale | Auto | Manual | Manual |

## ❓ Need Help?

- [Pusher Documentation](https://pusher.com/docs)
- [Socket.io Documentation](https://socket.io/docs)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

