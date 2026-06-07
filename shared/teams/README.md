# 👥 Teams Module

Team management with invitations, roles, and collaboration features.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Dependencies](#-dependencies)
3. [Environment Variables](#-environment-variables)
4. [Database Schema](#-database-schema)
5. [API Reference](#-api-reference)
6. [Frontend Components](#-frontend-components)
7. [Email Invitations](#-email-invitations)

---

## 🚀 Quick Start

```bash
# Add teams module
npx saas-factory add teams

# Install dependencies
npm install

# Apply database schema
cd backend && npx prisma db push

# Start development
npm run dev
```

---

## 📦 Dependencies

No additional dependencies required beyond the core setup.

---

## 🔧 Environment Variables

```env
# ================================
# Email for Invitations
# ================================
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
FROM_EMAIL=noreply@yourapp.com

# ================================
# URLs
# ================================
FRONTEND_URL=http://localhost:3000
```

---

## 🗄️ Database Schema

Add to your Prisma schema:

```prisma
model Team {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  logo        String?
  
  // Relations
  members     TeamMember[]
  invitations TeamInvitation[]
  
  // Timestamps
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  
  @@index([slug])
}

model TeamMember {
  id        String   @id @default(cuid())
  
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  role      String   @default("member")  // 'owner', 'admin', 'member'
  
  joinedAt  DateTime @default(now())
  
  @@unique([teamId, userId])
  @@index([userId])
}

model TeamInvitation {
  id        String   @id @default(cuid())
  
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  email     String
  role      String   @default("member")
  token     String   @unique
  
  invitedBy String
  expiresAt DateTime
  
  createdAt DateTime @default(now())
  
  @@unique([teamId, email])
  @@index([token])
}
```

### Apply Schema

```bash
cd backend
npx prisma db push
```

---

## 📡 API Reference

### Create Team

```http
POST /api/teams
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Team",
  "slug": "my-team"
}
```

**Response:**
```json
{
  "team": {
    "id": "clx...",
    "name": "My Team",
    "slug": "my-team",
    "members": [
      { "userId": "...", "role": "owner" }
    ]
  }
}
```

### Get User's Teams

```http
GET /api/teams
Authorization: Bearer <token>
```

### Get Team Details

```http
GET /api/teams/:teamId
Authorization: Bearer <token>
```

### Update Team

```http
PUT /api/teams/:teamId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Team Name"
}
```

### Delete Team

```http
DELETE /api/teams/:teamId
Authorization: Bearer <token>
```

### Invite Member

```http
POST /api/teams/:teamId/invitations
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newmember@example.com",
  "role": "member"
}
```

### Accept Invitation

```http
POST /api/teams/invitations/accept
Content-Type: application/json

{
  "token": "invitation-token"
}
```

### Remove Member

```http
DELETE /api/teams/:teamId/members/:userId
Authorization: Bearer <token>
```

### Update Member Role

```http
PUT /api/teams/:teamId/members/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

---

## 🖥️ Frontend Components

### Teams List Page

```tsx
// app/dashboard/teams/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Users, Settings, Crown, Shield, User } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        setTeams(data.teams);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Teams</h1>
        <Link
          href="/dashboard/teams/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <Plus className="w-5 h-5" />
          Create Team
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => {
          const RoleIcon = roleIcons[team.role];
          
          return (
            <Link
              key={team.id}
              href={`/dashboard/teams/${team.id}`}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary-600" />
                </div>
                <span className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                  team.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                  team.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  <RoleIcon className="w-4 h-4" />
                  {team.role}
                </span>
              </div>
              
              <h3 className="font-semibold text-lg mb-1">{team.name}</h3>
              <p className="text-gray-500 text-sm">{team.memberCount} members</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

### Team Settings Page

```tsx
// app/dashboard/teams/[teamId]/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2, UserPlus, Crown, Shield, User } from 'lucide-react';

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    fetch(`/api/teams/${params.teamId}`)
      .then(res => res.json())
      .then(data => setTeam(data.team));
  }, [params.teamId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);

    try {
      await fetch(`/api/teams/${params.teamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      
      setInviteEmail('');
      alert('Invitation sent!');
    } catch (error) {
      alert('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member?')) return;
    
    await fetch(`/api/teams/${params.teamId}/members/${userId}`, {
      method: 'DELETE'
    });
    
    // Refresh team data
    const res = await fetch(`/api/teams/${params.teamId}`);
    const data = await res.json();
    setTeam(data.team);
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    await fetch(`/api/teams/${params.teamId}/members/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    
    // Refresh
    const res = await fetch(`/api/teams/${params.teamId}`);
    const data = await res.json();
    setTeam(data.team);
  };

  if (!team) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{team.name} - Settings</h1>

      {/* Invite Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Invite Member</h2>
        <form onSubmit={handleInvite} className="flex gap-4">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 px-4 py-2 border rounded-lg"
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={isInviting}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Members ({team.members.length})</h2>
        <div className="space-y-4">
          {team.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-3 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  {member.user.name?.[0] || member.user.email[0]}
                </div>
                <div>
                  <p className="font-medium">{member.user.name || member.user.email}</p>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {member.role !== 'owner' && (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                      className="px-3 py-1 border rounded text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {member.role === 'owner' && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Crown className="w-4 h-4" />
                    Owner
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 📧 Email Invitations

### Invitation Email Template

```javascript
// utils/inviteEmail.js
export function getInviteEmailHtml({ teamName, inviterName, inviteUrl }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #4F46E5;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>You're invited to join ${teamName}!</h1>
        <p>${inviterName} has invited you to collaborate on ${teamName}.</p>
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
        <p>This invitation expires in 7 days.</p>
        <p>If you didn't expect this invitation, you can ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}
```

---

## 🔒 Role Permissions

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| View team | ✅ | ✅ | ✅ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Delete team | ✅ | ❌ | ❌ |
| Update settings | ✅ | ✅ | ❌ |

---

## ❓ Troubleshooting

### "Invitation expired"
- Invitations expire after 7 days
- Admin should send a new invitation

### "Already a member"
- User is already in the team
- Check team members list

### "Not authorized"
- User doesn't have permission for this action
- Check role requirements

---

## 📚 Resources

- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)
