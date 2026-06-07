/**
 * Main Express Application Entry Point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import Routes
import authRoutes from './routes/auth.js';
import billingRoutes from './routes/billing.js';
import workspacesRoutes from './routes/workspaces.js';
import teamsRoutes from './routes/teams.js';
import permissionsRoutes from './routes/permissions.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.env !== 'test') {
  app.use(morgan('combined'));
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/billing', billingRoutes);
apiRouter.use('/workspaces', workspacesRoutes);
apiRouter.use('/teams', teamsRoutes);
apiRouter.use('/permissions', permissionsRoutes);

app.use(config.apiPrefix, apiRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SaaS API',
    version: '1.0.0',
    docs: `${config.apiPrefix}/docs`,
  });
});

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
const server = app.listen(config.port, () => {
  console.log(`
  🚀 Server is running!
  
  Environment: ${config.env}
  Port: ${config.port}
  API: http://localhost:${config.port}${config.apiPrefix}
  Health: http://localhost:${config.port}/health
  `);
});

// Graceful Shutdown
const shutdown = () => {
  console.log('\n👋 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;

