-- Create database
CREATE DATABASE IF NOT EXISTS signature_crm;

-- Connect to the database
\c signature_crm;

-- Conversations table - stores all user interactions
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL, -- 'telegram', 'whatsapp'
  message_type VARCHAR(50) NOT NULL, -- 'text', 'voice', 'image'
  user_message TEXT,
  agent_response TEXT,
  intent_detected VARCHAR(100),
  tools_called TEXT[], -- Array of tool names
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session state - maintains context within conversations
CREATE TABLE IF NOT EXISTS session_state (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  current_record_id VARCHAR(255),
  current_record_module VARCHAR(50), -- 'Leads', 'Contacts', 'Deals'
  current_record_name VARCHAR(255),
  pending_action VARCHAR(255),
  mentioned_entities JSONB, -- JSON array of entities
  last_search_results JSONB,
  conversation_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quote follow-up sequences - tracks which emails have been sent
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
);

-- Email approvals - tracks emails waiting for approval
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
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'sent'
  approval_message_id VARCHAR(255), -- Telegram message ID for approval
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  sent_at TIMESTAMP
);

-- Inbox processing log - tracks processed emails
CREATE TABLE IF NOT EXISTS inbox_log (
  id SERIAL PRIMARY KEY,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  subject VARCHAR(255),
  body TEXT,
  category VARCHAR(50), -- 'NEW_LEAD', 'REPLY_POSITIVE', 'REPLY_NEGATIVE', 'REPLY_QUESTION', 'OUT_OF_OFFICE', 'SPAM', 'SUPPLIER'
  sentiment VARCHAR(50), -- 'positive', 'negative', 'neutral', 'question'
  crm_record_id VARCHAR(255),
  crm_record_module VARCHAR(50),
  action_taken VARCHAR(255),
  processed BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Autonomous tasks - tracks scheduled autonomous actions
CREATE TABLE IF NOT EXISTS autonomous_tasks (
  id SERIAL PRIMARY KEY,
  task_type VARCHAR(100) NOT NULL, -- 'quote_followup', 'pipeline_briefing', 'inbox_check', 'stale_deal_alert'
  deal_id VARCHAR(255),
  contact_id VARCHAR(255),
  scheduled_for TIMESTAMP NOT NULL,
  executed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'executed', 'failed', 'skipped'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval queue - tracks pending approvals
CREATE TABLE IF NOT EXISTS approval_queue (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(100) NOT NULL, -- 'send_email', 'bulk_email', 'delete_record'
  action_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  requested_by VARCHAR(255),
  approved_by VARCHAR(255),
  telegram_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_session_state_user_id ON session_state(user_id);
CREATE INDEX idx_quote_sequences_deal_id ON quote_sequences(deal_id);
CREATE INDEX idx_quote_sequences_sequence_cancelled ON quote_sequences(sequence_cancelled);
CREATE INDEX idx_email_approvals_status ON email_approvals(status);
CREATE INDEX idx_inbox_log_from_email ON inbox_log(from_email);
CREATE INDEX idx_autonomous_tasks_status ON autonomous_tasks(status);
CREATE INDEX idx_autonomous_tasks_scheduled_for ON autonomous_tasks(scheduled_for);
CREATE INDEX idx_approval_queue_status ON approval_queue(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_state_updated_at BEFORE UPDATE ON session_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_sequences_updated_at BEFORE UPDATE ON quote_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
