# 🔐 Authentication Module

Complete authentication system with JWT, OAuth, and email verification.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Dependencies](#-dependencies)
3. [Environment Variables](#-environment-variables)
4. [Files Added](#-files-added)
5. [Step-by-Step Setup](#-step-by-step-setup)
6. [API Reference](#-api-reference)
7. [Frontend Integration](#-frontend-integration)
8. [OAuth Setup](#-oauth-setup)
9. [Security Best Practices](#-security-best-practices)

---

## 🚀 Quick Start

```bash
# Add auth module to your project
npx saas-factory add auth

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start development
npm run dev
```

---

## 📦 Dependencies

### Backend (Node.js/Express)

Add to `backend/package.json`:

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.13",
    "zod": "^3.22.4"
  }
}
```

Install:
```bash
cd backend && npm install bcryptjs jsonwebtoken nodemailer zod
```

### Backend (Python/FastAPI)

Add to `requirements.txt`:

```txt
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
```

Install:
```bash
pip install -r requirements.txt
```

### Frontend (Next.js)

Add to `frontend/package.json`:

```json
{
  "dependencies": {
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.3.4",
    "zod": "^3.22.4"
  }
}
```

Install:
```bash
cd frontend && npm install react-hook-form @hookform/resolvers zod
```

---

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# ================================
# JWT Configuration (Required)
# ================================
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# ================================
# Email Verification (Optional)
# ================================
EMAIL_VERIFICATION_REQUIRED=false  # Set to 'true' to require email verification

# SMTP Settings (if email verification enabled)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
FROM_EMAIL=noreply@yourapp.com

# ================================
# OAuth Providers (Optional)
# ================================
# Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# ================================
# URLs
# ================================
FRONTEND_URL=http://localhost:3000
```

### Generating a Secure JWT Secret

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

---

## 📁 Files Added

```
your-project/
├── frontend/
│   └── app/auth/
│       ├── login/page.tsx           # Login page
│       ├── register/page.tsx        # Registration page
│       ├── forgot-password/page.tsx # Password recovery
│       ├── reset-password/page.tsx  # Password reset
│       └── verify-email/page.tsx    # Email verification
│
├── backend/
│   ├── src/routes/auth.js           # Auth API routes
│   └── src/middleware/auth.js       # JWT middleware
│
└── shared/auth/
    └── utils/
        ├── emailService.js          # Email sending
        ├── passwordUtils.js         # Password hashing
        └── verificationUtils.js     # Token generation
```

---

## 📝 Step-by-Step Setup

### Step 1: Database Schema

Add to your Prisma schema (`backend/prisma/schema.prisma`):

```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  password          String
  name              String?
  avatar            String?
  
  // Email verification
  emailVerified     Boolean   @default(false)
  verificationToken String?
  
  // Password reset
  resetToken        String?
  resetTokenExpiry  DateTime?
  
  // OAuth
  provider          String?   // 'email', 'google', 'github'
  providerId        String?
  
  // Timestamps
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  lastLoginAt       DateTime?
  
  // Relations
  refreshTokens     RefreshToken[]
  
  @@index([email])
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([token])
  @@index([userId])
}
```

### Step 2: Apply Database Changes

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

### Step 3: Register Auth Routes

Add to your Express server (`backend/src/index.js`):

```javascript
import authRoutes from './routes/auth.js';

// Public auth routes
app.use('/api/auth', authRoutes);

// Protected routes example
import { authMiddleware } from './middleware/auth.js';
app.use('/api/protected', authMiddleware, protectedRoutes);
```

### Step 4: Test the Auth Flow

```bash
# Start the backend
cd backend && npm run dev

# Test registration
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!","name":"Test User"}'

# Test login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'
```

---

## 📡 API Reference

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbG..."
}
```

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

### Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "password": "NewPassword123!"
}
```

### Verify Email

```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "verification-token-from-email"
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <accessToken>
```

---

## 🖥️ Frontend Integration

### Auth Context

```tsx
// hooks/useAuth.ts
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await res.json();
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
  };

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    localStorage.removeItem('accessToken');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

### Protected Route

```tsx
// components/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div>Loading...</div>;
  if (!user) return null;

  return children;
}
```

---

## 🔗 OAuth Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth Client ID**
5. Select **Web Application**
6. Add authorized redirect URI: `http://localhost:8000/api/auth/google/callback`
7. Copy Client ID and Secret to `.env`

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set Homepage URL: `http://localhost:3000`
4. Set Authorization callback URL: `http://localhost:8000/api/auth/github/callback`
5. Copy Client ID and Secret to `.env`

---

## 🔒 Security Best Practices

1. **JWT Secret**: Use at least 32 random characters
2. **Password Requirements**: Enforce minimum 8 characters, mixed case, numbers
3. **Rate Limiting**: Add rate limiting to auth endpoints
4. **HTTPS**: Always use HTTPS in production
5. **Token Storage**: Store refresh tokens in httpOnly cookies
6. **Token Rotation**: Rotate refresh tokens on use

---

## ❓ Troubleshooting

### "Invalid token" error
- Check JWT_SECRET matches between frontend and backend
- Ensure token hasn't expired

### "Email already exists" on register
- User already registered, suggest login or password reset

### OAuth callback fails
- Verify redirect URIs match exactly in provider settings
- Check client ID and secret are correct

---

## 📚 Need Help?

- [JWT.io Debugger](https://jwt.io/) - Debug JWT tokens
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)
