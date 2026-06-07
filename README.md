# kgagentico

> Generated with [SaaS Factory](https://github.com/saas-factory) 🏭

A full-featured SaaS application boilerplate with everything you need to launch your product.

## 🚀 Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **State Management:** React Context + Hooks
- **Forms:** React Hook Form

### Backend
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Caching:** Redis

## 📦 Installed Modules

- 🔐 **Authentication** - Complete auth system with login, register, password reset, and OAuth support
- 💳 **Payments** - Stripe integration with subscriptions, billing portal, and webhooks
- 🏢 **Workspaces** - Multi-tenant architecture with workspace switching
- 🛡️ **Permissions** - Role-based access control (RBAC) system
- 👥 **Teams** - Team management with invitations and member roles
- 📊 **Dashboard UI** - Pre-built dashboard components and layouts
- email
- notifications
- storage
- pricing
- onboarding
- analytics
- audit-log
- blog
- i18n
- ai
- admin
- webhooks
- jobs
- feature-flags
- rate-limit
- deploy
- testing

## 🏁 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (optional)

### Installation

```bash
# Clone and enter the project
cd kgagentico

# Copy environment variables
cp .env.example .env

# Install all dependencies
npm run install:all

# Start development servers
npm run dev
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Update the database connection string
3. Add your API keys (Stripe, OAuth providers, etc.)

## 📁 Project Structure

```
kgagentico/
├── frontend/                 # Next.js application
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   └── lib/                  # Utilities
├── backend/                  # Express server
│   ├── routes/              # API routes
│   ├── middleware/          # Middleware
│   └── utils/               # Utilities
├── shared/                   # Shared modules
│   ├── utils/                # Common utilities
│   └── auth/
│   └── payments/
│   └── workspaces/
│   └── permissions/
│   └── teams/
│   └── ui/
│   └── email/
│   └── notifications/
│   └── storage/
│   └── pricing/
│   └── onboarding/
│   └── analytics/
│   └── audit-log/
│   └── blog/
│   └── i18n/
│   └── ai/
│   └── admin/
│   └── webhooks/
│   └── jobs/
│   └── feature-flags/
│   └── rate-limit/
│   └── deploy/
│   └── testing/
├── .env.example              # Environment template
└── package.json              # Root package.json
```

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all development servers |
| `npm run dev:frontend` | Start frontend only |
| `npm run dev:backend` | Start backend only |
| `npm run build` | Build for production |
| `npm run lint` | Run linters |

## 🔧 Configuration

### Database

Update your database URL in `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/kgagentico_db
```

### Stripe Setup

1. Get your API keys from [Stripe Dashboard](https://dashboard.stripe.com)
2. Add keys to `.env`
3. Set up webhook endpoint: `/api/webhooks/stripe`
4. Configure products and prices in Stripe

### Authentication

The auth module supports:
- Email/Password authentication
- Simple auth (no email verification required)
- JWT tokens with refresh
- Password reset flow
- Session management

**Configured OAuth Providers:**
- Google
- Github

Configure OAuth providers in `.env` with your client credentials.

## 📄 License

MIT License - feel free to use this for any project!

---

Built with ❤️ using [SaaS Factory](https://github.com/saas-factory)
