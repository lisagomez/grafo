/**
 * Application Configuration
 * Centralizes all environment variables and settings
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Server
  port: parseInt(process.env.PORT, 10) || 8000,
  apiPrefix: process.env.API_PREFIX || '/api',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Neo4j (grafo legal)
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'neo4j',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },

  // Jurisdicción por defecto (Legal Context Resolver)
  defaultCountry: process.env.DEFAULT_COUNTRY || 'MX',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },
  
  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    prices: {
      basic: process.env.STRIPE_PRICE_ID_BASIC,
      pro: process.env.STRIPE_PRICE_ID_PRO,
      enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE,
    },
  },
  
  // OAuth
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
  
  // Email
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.FROM_EMAIL || 'noreply@example.com',
  },
  
  // Roles por defecto
  permissions: {
    defaultRole: process.env.DEFAULT_ROLE || 'member',
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
  },
};

// Validate required configuration
const requiredEnvVars = ['DATABASE_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && config.env === 'production') {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

export default config;

