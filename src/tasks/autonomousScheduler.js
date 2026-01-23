/**
 * Autonomous Scheduler
 * Handles scheduled autonomous tasks (quote follow-ups, pipeline briefings, etc.)
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const db = require('../db/connection');
const zohoService = require('../services/zohoService');
const emailService = require('../services/emailService');
const { Telegraf } = require('telegraf');

class AutonomousScheduler {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.tasks = [];
  }

  /**
   * Initialize all scheduled tasks
   */
  initializeTasks() {
    logger.info('Initializing autonomous scheduler tasks');

    // Morning pipeline briefing - 8:00 AM Mon-Fri
    this.schedulePipelineBriefing();

    // Quote follow-up dispatch - 9:00 AM Mon-Fri
    this.scheduleQuoteFollowups();

    // Inbox processing - Every 15 minutes
    this.scheduleInboxProcessing();

    // Stale deal detection - 8:00 AM daily
    this.scheduleStaleDealsCheck();

    logger.info('Autonomous scheduler initialized with all tasks');
  }

  /**
   * Schedule morning pipeline briefing
   */
  schedulePipelineBriefing() {
    // 0 8 * * 1-5 = 8:00 AM Monday-Friday
    const task = cron.schedule('0 8 * * 1-5', async () => {
      try {
        logger.info('Running scheduled pipeline briefing');
        await this.sendPipelineBriefing();
      } catch (error) {
        logger.error('Pipeline briefing failed', { error: error.message });
      }
    });

    this.tasks.push(task);
  }

  /**
   * Schedule quote follow-up emails
   */
  scheduleQuoteFollowups() {
    // 0 9 * * 1-5 = 9:00 AM Monday-Friday
    const task = cron.schedule('0 9 * * 1-5', async () => {
      try {
        logger.info('Running scheduled quote follow-ups');
        await this.processQuoteFollowups();
      } catch (error) {
        logger.error('Quote follow-ups failed', { error: error.message });
      }
    });

    this.tasks.push(task);
  }

  /**
   * Schedule inbox processing
   */
  scheduleInboxProcessing() {
    // */15 * * * * = Every 15 minutes
    const task = cron.schedule('*/15 * * * *', async () => {
      try {
        logger.debug('Running scheduled inbox processing');
        await this.processInbox();
      } catch (error) {
        logger.error('Inbox processing failed', { error: error.message });
      }
    });

    this.tasks.push(task);
  }

  /**
   * Schedule stale deals check
   */
  scheduleStaleDealsCheck() {
    // 0 8 * * * = 8:00 AM daily
    const task = cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('Running scheduled stale deals check');
        await this.checkStaleDeals();
      } catch (error) {
        logger.error('Stale deals check failed', { error: error.message });
      }
    });

    this.tasks.push(task);
  }

  /**
   * Send morning pipeline briefing
   */
  async sendPipelineBriefing() {
    try {
      const deals = await zohoService.getPipeline();

      if (deals.length === 0) {
        logger.info('No active deals for briefing');
        return;
      }

      // Categorize deals by staleness
      const now = new Date();
      const healthy = [];
      const attention = [];
      const urgent = [];
      const critical = [];

      deals.forEach((deal) => {
        const lastActivity = deal.Last_Activity_Time ? new Date(deal.Last_Activity_Time) : new Date(deal.Created_Time);
        const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

        if (daysSinceActivity < 7) {
          healthy.push({ ...deal, daysSinceActivity });
        } else if (daysSinceActivity < 14) {
          attention.push({ ...deal, daysSinceActivity });
        } else if (daysSinceActivity < 21) {
          urgent.push({ ...deal, daysSinceActivity });
        } else {
          critical.push({ ...deal, daysSinceActivity });
        }
      });

      // Build briefing message
      let briefing = `📊 MORNING PIPELINE BRIEFING\n`;
      briefing += `${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
      briefing += `ACTIVE DEALS: ${deals.length} (£${deals.reduce((sum, d) => sum + (d.Amount || 0), 0)})\n\n`;

      if (healthy.length > 0) {
        briefing += `🟢 HEALTHY (${healthy.length}):\n`;
        healthy.forEach((d) => {
          briefing += `• ${d.Deal_Name} - ${d.Stage} - £${d.Amount || 0} - ${d.daysSinceActivity}d\n`;
        });
        briefing += '\n';
      }

      if (attention.length > 0) {
        briefing += `⚠️ ATTENTION (${attention.length}):\n`;
        attention.forEach((d) => {
          briefing += `• ${d.Deal_Name} - ${d.Stage} - £${d.Amount || 0} - ${d.daysSinceActivity}d\n`;
        });
        briefing += '\n';
      }

      if (urgent.length > 0) {
        briefing += `🚨 URGENT (${urgent.length}):\n`;
        urgent.forEach((d) => {
          briefing += `• ${d.Deal_Name} - ${d.Stage} - £${d.Amount || 0} - ${d.daysSinceActivity}d\n`;
        });
        briefing += '\n';
      }

      if (critical.length > 0) {
        briefing += `💀 CRITICAL (${critical.length}):\n`;
        critical.forEach((d) => {
          briefing += `• ${d.Deal_Name} - ${d.Stage} - £${d.Amount || 0} - ${d.daysSinceActivity}d\n`;
        });
        briefing += '\n';
      }

      // Send to group chat
      const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
      if (groupChatId) {
        await this.bot.telegram.sendMessage(groupChatId, briefing);
        logger.info('Pipeline briefing sent to group chat');
      }
    } catch (error) {
      logger.error('Failed to send pipeline briefing', { error: error.message });
    }
  }

  /**
   * Process quote follow-ups
   */
  async processQuoteFollowups() {
    try {
      // Get all active quote sequences
      const result = await db.query(
        `SELECT * FROM quote_sequences 
        WHERE sequence_cancelled = false 
        AND quote_sent_date IS NOT NULL`
      );

      const sequences = result.rows;
      logger.info(`Processing ${sequences.length} quote sequences`);

      for (const seq of sequences) {
        const daysSinceQuote = Math.floor((Date.now() - new Date(seq.quote_sent_date)) / (1000 * 60 * 60 * 24));

        // Day 3 follow-up
        if (daysSinceQuote >= 3 && !seq.followup_1_sent) {
          await this.sendQuoteFollowup(seq, 1);
        }

        // Day 7 follow-up
        if (daysSinceQuote >= 7 && !seq.followup_2_sent) {
          await this.sendQuoteFollowup(seq, 2);
        }

        // Day 14 follow-up
        if (daysSinceQuote >= 14 && !seq.followup_3_sent) {
          await this.sendQuoteFollowup(seq, 3);
        }

        // Day 21 - close as lost
        if (daysSinceQuote >= 21 && !seq.sequence_cancelled) {
          await this.closeQuoteAsLost(seq);
        }
      }
    } catch (error) {
      logger.error('Failed to process quote follow-ups', { error: error.message });
    }
  }

  /**
   * Send quote follow-up email
   * @param {object} sequence - Quote sequence record
   * @param {number} followupNumber - Follow-up number (1, 2, or 3)
   */
  async sendQuoteFollowup(sequence, followupNumber) {
    try {
      const templateId = `quote_followup_${followupNumber}`;
      const template = emailService.getTemplate(templateId);

      if (!template) {
        logger.error('Template not found', { templateId });
        return;
      }

      // Replace variables
      const variables = {
        first_name: sequence.contact_name?.split(' ')[0] || 'there',
        company: sequence.deal_name,
        sender_name: 'Nick',
        sender_phone: '01392 931035',
      };

      const subject = emailService.replaceVariables(template.subject, variables);
      const body = emailService.replaceVariables(template.body, variables);

      // Send email
      await emailService.sendEmail({
        to_email: sequence.contact_email,
        to_name: sequence.contact_name,
        subject,
        body,
        record_id: sequence.deal_id,
      });

      // Update sequence record
      const updateField = `followup_${followupNumber}_sent`;
      const updateFieldAt = `followup_${followupNumber}_sent_at`;

      await db.query(
        `UPDATE quote_sequences 
        SET ${updateField} = true, ${updateFieldAt} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [sequence.id]
      );

      logger.info(`Quote follow-up ${followupNumber} sent`, {
        dealId: sequence.deal_id,
        dealName: sequence.deal_name,
      });

      // Alert team
      const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
      if (groupChatId) {
        await this.bot.telegram.sendMessage(
          groupChatId,
          `📧 Follow-up #${followupNumber} sent to ${sequence.contact_name} at ${sequence.deal_name}`
        );
      }
    } catch (error) {
      logger.error('Failed to send quote follow-up', { error: error.message });
    }
  }

  /**
   * Close quote as lost
   * @param {object} sequence - Quote sequence record
   */
  async closeQuoteAsLost(sequence) {
    try {
      // Update sequence
      await db.query(
        `UPDATE quote_sequences 
        SET sequence_cancelled = true, cancelled_reason = 'No response after 21 days', cancelled_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [sequence.id]
      );

      // Update deal in Zoho
      await zohoService.updateRecord(sequence.deal_id, 'Deals', {
        Stage: 'Closed Lost',
      });

      logger.info('Quote closed as lost', {
        dealId: sequence.deal_id,
        dealName: sequence.deal_name,
      });

      // Alert team
      const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
      if (groupChatId) {
        await this.bot.telegram.sendMessage(
          groupChatId,
          `💀 Deal closed as lost: ${sequence.deal_name} (£${sequence.deal_value}/mo) - No response after 21 days`
        );
      }
    } catch (error) {
      logger.error('Failed to close quote as lost', { error: error.message });
    }
  }

  /**
   * Process inbox
   */
  async processInbox() {
    try {
      logger.debug('Processing inbox');
      // TODO: Implement inbox monitoring
      // This would connect to email service and process incoming emails
    } catch (error) {
      logger.error('Failed to process inbox', { error: error.message });
    }
  }

  /**
   * Check for stale deals
   */
  async checkStaleDeals() {
    try {
      const deals = await zohoService.getPipeline();
      const now = new Date();
      const staleDeals = [];

      deals.forEach((deal) => {
        const lastActivity = deal.Last_Activity_Time ? new Date(deal.Last_Activity_Time) : new Date(deal.Created_Time);
        const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

        if (daysSinceActivity >= 14) {
          staleDeals.push({
            ...deal,
            daysSinceActivity,
          });
        }
      });

      if (staleDeals.length > 0) {
        logger.info(`Found ${staleDeals.length} stale deals`);

        // Alert team
        const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
        if (groupChatId) {
          let message = `⚠️ STALE DEALS ALERT\n\n`;
          staleDeals.forEach((deal) => {
            message += `• ${deal.Deal_Name} - ${deal.daysSinceActivity} days - £${deal.Amount || 0}\n`;
          });
          await this.bot.telegram.sendMessage(groupChatId, message);
        }
      }
    } catch (error) {
      logger.error('Failed to check stale deals', { error: error.message });
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll() {
    this.tasks.forEach((task) => task.stop());
    logger.info('All scheduled tasks stopped');
  }
}

module.exports = AutonomousScheduler;
