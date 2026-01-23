/**
 * Telegram Bot Handler
 * Processes incoming Telegram messages and routes to AI agent core
 */

const { Telegraf } = require('telegraf');
const logger = require('../utils/logger');
const db = require('../db/connection');
const aiAgentCore = require('../services/aiAgentCore');

class TelegramHandler {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.authorizedUsers = {
      nelson: process.env.TELEGRAM_CHAT_ID_NELSON,
    };
  }

  /**
   * Check if user is authorized
   */
  isAuthorized(chatId) {
    return Object.values(this.authorizedUsers).includes(chatId.toString());
  }

  /**
   * Get user identifier from chat ID
   */
  getUserId(chatId) {
    for (const [userId, id] of Object.entries(this.authorizedUsers)) {
      if (id === chatId.toString()) {
        return userId;
      }
    }
    return 'unknown';
  }

  /**
   * Initialize bot handlers
   */
  initializeHandlers() {
    // Start command
    this.bot.start((ctx) => {
      if (!this.isAuthorized(ctx.chat.id)) {
        ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
        return;
      }

      ctx.reply(
        `👋 Welcome to Signature Cleans CRM Agent!\n\n` +
          `I can help you with:\n` +
          `• Create leads: "New lead: ABC Company, John Smith, 07712345678"\n` +
          `• Search records: "Find Sarah at Sudlow"\n` +
          `• Pipeline summary: "Pipeline summary"\n` +
          `• Sales metrics: "Show sales metrics"\n` +
          `• And much more!\n\n` +
          `Send /help for all available commands.`
      );
    });

    // Help command
    this.bot.help((ctx) => {
      if (!this.isAuthorized(ctx.chat.id)) {
        ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
        return;
      }

      ctx.reply(
        `📚 Available Commands:\n\n` +
          `/start - Initialize conversation\n` +
          `/help - Show this help message\n` +
          `/pipeline - Quick pipeline summary\n` +
          `/metrics - Sales metrics\n` +
          `/search [term] - Search CRM\n\n` +
          `Or just type naturally:\n` +
          `"Create lead for ABC Company"\n` +
          `"What's the status of Sudlow?"\n` +
          `"Show stale deals"`
      );
    });

    // Pipeline command
    this.bot.command('pipeline', (ctx) => this.handlePipelineCommand(ctx));

    // Metrics command
    this.bot.command('metrics', (ctx) => this.handleMetricsCommand(ctx));

    // Search command
    this.bot.command('search', (ctx) => this.handleSearchCommand(ctx));

    // Text messages
    this.bot.on('text', (ctx) => this.handleTextMessage(ctx));

    // Voice messages
    this.bot.on('voice', (ctx) => this.handleVoiceMessage(ctx));

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error('Telegram bot error', { error: err.message });
      ctx.reply('Sorry, something went wrong. Please try again.');
    });
  }

  /**
   * Handle text messages
   */
  async handleTextMessage(ctx) {
    const startTime = Date.now();

    try {
      if (!this.isAuthorized(ctx.chat.id)) {
        ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
        return;
      }

      const userId = this.getUserId(ctx.chat.id);
      const message = ctx.message.text;

      logger.info('Received text message', { userId, message });

      // Show typing indicator
      await ctx.sendChatAction('typing');

      // Process with AI agent core
      const result = await aiAgentCore.processRequest(message, { userId, chatId: ctx.chat.id });

      const duration = Date.now() - startTime;

      // Log conversation
      await db.query(
        `INSERT INTO conversations 
        (user_id, channel, message_type, user_message, agent_response, intent_detected, response_time_ms, success)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, 'telegram', 'text', message, result.response, result.intent, duration, result.success]
      );

      // Send response
      ctx.reply(result.response);
    } catch (error) {
      logger.error('Error handling text message', { error: error.message });
      ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  /**
   * Handle voice messages
   */
  async handleVoiceMessage(ctx) {
    try {
      if (!this.isAuthorized(ctx.chat.id)) {
        ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
        return;
      }

      const userId = this.getUserId(ctx.chat.id);

      logger.info('Received voice message', { userId });

      await ctx.sendChatAction('typing');

      // TODO: Implement voice transcription with Whisper
      ctx.reply('Voice messages coming soon! For now, please send text messages.');
    } catch (error) {
      logger.error('Error handling voice message', { error: error.message });
      ctx.reply('Sorry, something went wrong processing your voice message.');
    }
  }

  /**
   * Handle /pipeline command
   */
  async handlePipelineCommand(ctx) {
    if (!this.isAuthorized(ctx.chat.id)) {
      ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
      return;
    }

    const userId = this.getUserId(ctx.chat.id);
    const result = await aiAgentCore.processRequest('Pipeline summary', { userId });
    ctx.reply(result.response);
  }

  /**
   * Handle /metrics command
   */
  async handleMetricsCommand(ctx) {
    if (!this.isAuthorized(ctx.chat.id)) {
      ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
      return;
    }

    const userId = this.getUserId(ctx.chat.id);
    const result = await aiAgentCore.processRequest('Sales metrics', { userId });
    ctx.reply(result.response);
  }

  /**
   * Handle /search command
   */
  async handleSearchCommand(ctx) {
    if (!this.isAuthorized(ctx.chat.id)) {
      ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
      return;
    }

    const args = ctx.message.text.split(' ').slice(1).join(' ');
    if (!args) {
      ctx.reply('Usage: /search [term]');
      return;
    }

    const userId = this.getUserId(ctx.chat.id);
    const result = await aiAgentCore.processRequest(`Search for ${args}`, { userId });
    ctx.reply(result.response);
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      this.initializeHandlers();
      await this.bot.launch();
      logger.info('Telegram bot started successfully');
    } catch (error) {
      logger.error('Failed to start Telegram bot', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop() {
    await this.bot.stop();
    logger.info('Telegram bot stopped');
  }
}

module.exports = TelegramHandler;
