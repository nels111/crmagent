/**
 * PostgreSQL Database Connection Module
 * Manages connection pooling and query execution
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Create connection pool
// Railway/Postgres typically requires SSL; localhost usually does not.
const isLocal =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: isLocal
    ? false
    : {
        rejectUnauthorized: false,
      },
});

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

/**
 * Execute a query with automatic error handling
 * @param {string} query - SQL query string
 * @param {array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(queryText, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(queryText, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms`, { query: queryText.substring(0, 50) });
    return result;
  } catch (error) {
    logger.error('Database query error', { 
      error: error.message, 
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      query: queryText.substring(0, 100) 
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transaction handling
 * @returns {Promise<object>} Database client
 */
async function getClient() {
  return pool.connect();
}

/**
 * Initialize database tables
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  try {
    logger.info('Initializing database tables...');
    
    // Create conversations table
    await query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        message_type VARCHAR(50) NOT NULL,
        user_message TEXT,
        agent_response TEXT,
        intent_detected VARCHAR(100),
        tools_called TEXT[],
        response_time_ms INTEGER,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create session_state table
    await query(`
      CREATE TABLE IF NOT EXISTS session_state (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        current_record_id VARCHAR(255),
        current_record_module VARCHAR(50),
        current_record_name VARCHAR(255),
        pending_action VARCHAR(255),
        mentioned_entities JSONB,
        last_search_results JSONB,
        conversation_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create quote_sequences table
    await query(`
      CREATE TABLE IF NOT EXISTS quote_sequences (
        id SERIAL PRIMARY KEY,
        deal_id VARCHAR(255) NOT NULL UNIQUE,
        deal_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255),
        deal_value DECIMAL(10, 2),
        quote_sent_date TIMESTAMP NOT NULL,
        followup_1_sent BOOLEAN DEFAULT false,
        followup_1_sent_at TIMESTAMP,
        followup_2_sent BOOLEAN DEFAULT false,
        followup_2_sent_at TIMESTAMP,
        followup_3_sent BOOLEAN DEFAULT false,
        followup_3_sent_at TIMESTAMP,
        sequence_cancelled BOOLEAN DEFAULT false,
        cancelled_reason VARCHAR(255),
        cancelled_at TIMESTAMP,
        last_activity_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create email_approvals table
    await query(`
      CREATE TABLE IF NOT EXISTS email_approvals (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        to_email VARCHAR(255) NOT NULL,
        to_name VARCHAR(255),
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        deal_id VARCHAR(255),
        deal_value DECIMAL(10, 2),
        template_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        approval_message_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        sent_at TIMESTAMP
      )
    `);

    // Create inbox_log table
    await query(`
      CREATE TABLE IF NOT EXISTS inbox_log (
        id SERIAL PRIMARY KEY,
        from_email VARCHAR(255) NOT NULL,
        from_name VARCHAR(255),
        subject VARCHAR(255),
        body TEXT,
        category VARCHAR(50),
        sentiment VARCHAR(50),
        crm_record_id VARCHAR(255),
        crm_record_module VARCHAR(50),
        action_taken VARCHAR(255),
        processed BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create autonomous_tasks table
    await query(`
      CREATE TABLE IF NOT EXISTS autonomous_tasks (
        id SERIAL PRIMARY KEY,
        task_type VARCHAR(100) NOT NULL,
        deal_id VARCHAR(255),
        contact_id VARCHAR(255),
        scheduled_for TIMESTAMP NOT NULL,
        executed_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create approval_queue table
    await query(`
      CREATE TABLE IF NOT EXISTS approval_queue (
        id SERIAL PRIMARY KEY,
        action_type VARCHAR(100) NOT NULL,
        action_data JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        requested_by VARCHAR(255),
        approved_by VARCHAR(255),
        telegram_message_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP
      )
    `);

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_session_state_user_id ON session_state(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_quote_sequences_deal_id ON quote_sequences(deal_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_quote_sequences_sequence_cancelled ON quote_sequences(sequence_cancelled)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_email_approvals_status ON email_approvals(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_inbox_log_from_email ON inbox_log(from_email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autonomous_tasks_status ON autonomous_tasks(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autonomous_tasks_scheduled_for ON autonomous_tasks(scheduled_for)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status)`);

    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Database initialization failed', { error: error.message });
    throw error;
  }
}

/**
 * Close the connection pool
 * @returns {Promise<void>}
 */
async function closePool() {
  await pool.end();
  logger.info('Database connection pool closed');
}

module.exports = {
  query,
  getClient,
  pool,
  initializeDatabase,
  closePool,
};
