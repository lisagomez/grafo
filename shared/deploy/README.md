# 🚀 Deployment Configs Module

Production-ready deployment configurations for popular platforms.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Platform Guide](#-platform-guide)
3. [Vercel Deployment](#-vercel-deployment)
4. [Docker Deployment](#-docker-deployment)
5. [Railway Deployment](#-railway-deployment)
6. [Fly.io Deployment](#-flyio-deployment)
7. [Environment Variables](#-environment-variables)
8. [CI/CD Setup](#-cicd-setup)

---

## 🚀 Quick Start

```bash
# Add deployment configs
npx saas-factory add deploy

# Choose your platform and follow the guide below
```

---

## 🎯 Platform Guide

| Platform | Best For | Pricing | Complexity |
|----------|----------|---------|------------|
| **Vercel** | Next.js apps | Free tier, then usage-based | ⭐ Easy |
| **Railway** | Full-stack apps | $5 credit/month, then usage | ⭐ Easy |
| **Fly.io** | Global edge | Free tier, then usage | ⭐⭐ Medium |
| **Docker** | Self-hosted, custom | Your hosting costs | ⭐⭐⭐ Advanced |

---

## ▲ Vercel Deployment

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Create `vercel.json`

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/.next",
  "framework": "nextjs",
  "installCommand": "npm run install:all",
  "regions": ["iad1"],
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://your-backend.com/api/:path*" }
  ]
}
```

### Step 3: Deploy

```bash
# Login to Vercel
vercel login

# Deploy preview
vercel

# Deploy to production
vercel --prod
```

### Step 4: Set Environment Variables

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings → Environment Variables**
4. Add all required variables

### Step 5: Connect Domain

1. Go to **Settings → Domains**
2. Add your domain
3. Update DNS records as instructed

---

## 🐳 Docker Deployment

### Step 1: Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# ==================
# Base Stage
# ==================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ==================
# Dependencies Stage
# ==================
FROM base AS deps
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN npm ci --only=production

# ==================
# Builder Stage (Frontend)
# ==================
FROM base AS frontend-builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY . .
WORKDIR /app/frontend
RUN npm run build

# ==================
# Builder Stage (Backend)
# ==================
FROM base AS backend-builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY . .
WORKDIR /app/backend
RUN npx prisma generate

# ==================
# Frontend Runner
# ==================
FROM base AS frontend-runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=frontend-builder /app/frontend/public ./public
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

# ==================
# Backend Runner
# ==================
FROM base AS backend-runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=backend-builder /app/backend ./
COPY --from=deps /app/backend/node_modules ./node_modules

EXPOSE 8000
CMD ["node", "src/index.js"]
```

### Step 2: Create `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Frontend (Next.js)
  frontend:
    build:
      context: .
      target: frontend-runner
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped

  # Backend (Express)
  backend:
    build:
      context: .
      target: backend-runner
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@db:5432/mydb
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    depends_on:
      - db
      - redis
    restart: unless-stopped

  # PostgreSQL Database
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  # Nginx Reverse Proxy (Optional)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Step 3: Create `.dockerignore`

```
node_modules
.next
.git
*.log
.env
.env.local
coverage
playwright-report
```

### Step 4: Build and Run

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Step 5: Database Migrations in Docker

```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Open Prisma Studio
docker-compose exec backend npx prisma studio
```

---

## 🚂 Railway Deployment

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2: Create `railway.toml`

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[env]
NODE_ENV = "production"
```

### Step 3: Deploy

```bash
# Login
railway login

# Initialize project
railway init

# Link to project
railway link

# Deploy
railway up

# View logs
railway logs
```

### Step 4: Add PostgreSQL

1. Go to Railway dashboard
2. Click **+ New** → **Database** → **PostgreSQL**
3. Railway automatically adds `DATABASE_URL`

### Step 5: Set Environment Variables

```bash
# Set variable
railway variables set JWT_SECRET=your-secret

# Or in dashboard: Settings → Variables
```

---

## 🪁 Fly.io Deployment

### Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Linux
curl -L https://fly.io/install.sh | sh
```

### Step 2: Create `fly.toml`

```toml
app = "your-app-name"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[services]]
  protocol = "tcp"
  internal_port = 3000

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.http_checks]]
    interval = 10000
    grace_period = "5s"
    method = "get"
    path = "/api/health"
    protocol = "http"
    timeout = 2000

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

### Step 3: Deploy

```bash
# Login
fly auth login

# Launch app (first time)
fly launch

# Deploy updates
fly deploy

# View logs
fly logs

# Open app
fly open
```

### Step 4: Add PostgreSQL

```bash
# Create PostgreSQL cluster
fly postgres create

# Attach to app
fly postgres attach --app your-app-name your-postgres-app-name
```

### Step 5: Set Secrets

```bash
# Set single secret
fly secrets set JWT_SECRET=your-secret

# Set from .env file
fly secrets import < .env.production

# View secrets
fly secrets list
```

---

## 🔧 Environment Variables

### Production Checklist

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | Set to `production` |
| `DATABASE_URL` | ✅ | Production database URL |
| `JWT_SECRET` | ✅ | Strong secret (32+ chars) |
| `FRONTEND_URL` | ✅ | Your frontend domain |
| `STRIPE_SECRET_KEY` | If payments | Live Stripe key |
| `STRIPE_WEBHOOK_SECRET` | If payments | Webhook signing secret |

### Generate Secrets

```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔄 CI/CD Setup

### GitHub Actions Deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  deploy-vercel:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Deploy to Vercel
        run: |
          npm i -g vercel
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-railway:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: your-service-name
```

---

## 📋 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables set
- [ ] Database migrated
- [ ] SSL certificate configured
- [ ] Error tracking enabled (Sentry)
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Rate limiting enabled
- [ ] CORS configured

---

## ❓ Troubleshooting

### Build fails on Vercel
- Check build logs for errors
- Verify Node.js version matches

### Database connection refused
- Check DATABASE_URL is correct
- Ensure database is accessible from platform

### SSL certificate issues
- Wait for certificate provisioning (can take up to 24h)
- Verify DNS records

---

## 📚 Resources

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Fly.io Docs](https://fly.io/docs)
- [Docker Docs](https://docs.docker.com)
