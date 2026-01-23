/**
 * Signature Cleans CRM Agent
 * Main application entry point with full integration
 */

require('dotenv').config();

const express = require('express');
const logger = require('./utils/logger');
const db = require('./db/connection');
const TelegramHandler = require('./handlers/telegramHandler');
const AutonomousScheduler = require('./tasks/autonomousScheduler');
const zohoService = require('./services/zohoService');

// Basic environment validation so we fail fast in production
function validateEnv() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID_NELSON',
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET',
    'ZOHO_REFRESH_TOKEN',
    'ZOHO_DATACENTER',
  ];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    // In production (Railway) this will cause the service to restart with clear logs
    process.exit(1);
  }
}

validateEnv();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message });
  process.exit(1);
});

/**
 * Main application class
 */
class SignatureCRMAgent {
  constructor() {
    this.telegramHandler = null;
    this.autonomousScheduler = null;
    this.httpServer = null;
  }

  /**
   * Test Zoho CRM connection
   */
  async testZohoCRMConnection() {
    try {
      logger.info('Testing Zoho CRM connection...');
      const token = await zohoService.getAccessToken();
      if (token) {
        logger.info('✅ Zoho CRM authentication successful');
        return true;
      }
    } catch (error) {
      logger.error('❌ Zoho CRM connection failed', { error: error.message });
      return false;
    }
  }

  /**
   * Test database connection
   */
  async testDatabaseConnection() {
    try {
      logger.info('Testing database connection...');
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        logger.error('❌ DATABASE_URL environment variable is not set');
        return false;
      }
      // Log first 20 chars of URL for debugging (without exposing password)
      const urlPreview = dbUrl.substring(0, 20) + '...';
      logger.debug('Database URL preview', { urlPreview });
      
      const result = await db.query('SELECT NOW()');
      if (result.rows.length > 0) {
        logger.info('✅ Database connection successful');
        return true;
      }
    } catch (error) {
      logger.error('❌ Database connection failed', { 
        error: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint || 'Check DATABASE_URL format and credentials'
      });
      return false;
    }
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      logger.info('🚀 Starting Signature Cleans CRM Agent');
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

      // Test connections
      logger.info('\n📋 Testing Connections...');
      const zohoConnected = await this.testZohoCRMConnection();
      const dbConnected = await this.testDatabaseConnection();

      if (!zohoConnected || !dbConnected) {
        logger.error('❌ Critical connections failed. Aborting startup.');
        process.exit(1);
      }

      // Initialize database
      logger.info('\n🗄️ Initializing database...');
      await db.initializeDatabase();
      logger.info('✅ Database initialized');

      // Start HTTP health server (needed for platforms like Railway)
      const app = express();
      const port = process.env.PORT || 3000;

      app.get('/health', async (_req, res) => {
        try {
          // Lightweight health checks – don't block on external APIs
          const dbHealthy = await this.testDatabaseConnection();
          res.status(dbHealthy ? 200 : 500).json({
            status: dbHealthy ? 'ok' : 'degraded',
            dbHealthy,
            env: process.env.NODE_ENV || 'development',
          });
        } catch (err) {
          logger.error('Health check failed', { error: err.message });
          res.status(500).json({ status: 'error', error: 'Health check failed' });
        }
      });

      this.httpServer = app.listen(port, () => {
        logger.info(`HTTP health server listening on port ${port}`);
      });

      // Initialize Telegram bot
      logger.info('\n🤖 Initializing Telegram bot...');
      this.telegramHandler = new TelegramHandler();
      await this.telegramHandler.start();
      logger.info('✅ Telegram bot started');

      // Initialize autonomous scheduler
      logger.info('\n⚙️ Initializing autonomous scheduler...');
      this.autonomousScheduler = new AutonomousScheduler();
      this.autonomousScheduler.initializeTasks();
      logger.info('✅ Autonomous scheduler initialized');

      logger.info('\n🎉 Signature Cleans CRM Agent is running!');
      logger.info('Listening for messages on Telegram...');
      logger.info('\n📊 Agent Capabilities:');
      logger.info('  ✓ Lead management (create, search, update)');
      logger.info('  ✓ Deal management (create, update, close)');
      logger.info('  ✓ Pipeline analysis & forecasting');
      logger.info('  ✓ Email automation & approval workflow');
      logger.info('  ✓ Task management');
      logger.info('  ✓ Sales metrics & analytics');
      logger.info('  ✓ Global search across all modules');
      logger.info('  ✓ Bulk operations');
      logger.info('  ✓ Autonomous quote follow-ups');
      logger.info('  ✓ Daily pipeline briefings');
      logger.info('  ✓ Inbox monitoring');
      logger.info('  ✓ Stale deal detection');
    } catch (error) {
      logger.error('Failed to initialize application', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('\n🛑 Shutting down gracefully...');

      if (this.httpServer) {
        await new Promise((resolve) => {
          this.httpServer.close(() => {
            logger.info('HTTP health server stopped');
            resolve();
          });
        });
      }

      if (this.telegramHandler) {
        await this.telegramHandler.stop();
      }

      if (this.autonomousScheduler) {
        this.autonomousScheduler.stopAll();
      }

      await db.closePool();

      logger.info('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  }
}

// Start the application
const agent = new SignatureCRMAgent();
agent.initialize();

// Handle shutdown signals
process.on('SIGINT', () => agent.shutdown());
process.on('SIGTERM', () => agent.shutdown());

module.exports = agent;
