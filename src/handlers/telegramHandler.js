/**
 * Telegram Bot Handler
 * Processes incoming Telegram messages and routes to the conversational AI agent
 * Enterprise-grade with rate limiting and security measures
 */

const { Telegraf } = require('telegraf');
const axios = require('axios');
const logger = require('../utils/logger');
const conversationAgent = require('../services/conversationAgent');
const openaiService = require('../services/openaiService');

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // Max requests per window
const VOICE_MAX_SIZE_MB = 10; // Max voice file size
const VOICE_DOWNLOAD_TIMEOUT_MS = 30000; // Voice download timeout

class TelegramHandler {
  constructor() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.authorizedUsers = this.parseAuthorizedUsers();

    // In-memory conversation history cache (per user, last N messages)
    this.conversationCache = new Map();
    this.maxCacheMessages = 20;

    // Rate limiting: track requests per user
    this.rateLimitMap = new Map();

    // Periodic cleanup of rate limit and conversation cache
    this.cleanupInterval = setInterval(() => this.cleanupCaches(), 300000); // Every 5 minutes

    logger.info('Telegram handler initialized', {
      authorizedCount: Object.keys(this.authorizedUsers).length,
    });
  }

  /**
   * Clean up stale entries from caches
   */
  cleanupCaches() {
    const now = Date.now();

    // Clean up rate limit entries older than window
    for (const [userId, data] of this.rateLimitMap.entries()) {
      if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        this.rateLimitMap.delete(userId);
      }
    }

    // Limit conversation cache size (max 100 users)
    if (this.conversationCache.size > 100) {
      const entries = Array.from(this.conversationCache.entries());
      // Remove oldest half
      entries.slice(0, 50).forEach(([key]) => this.conversationCache.delete(key));
    }

    logger.debug('Caches cleaned up', {
      rateLimitEntries: this.rateLimitMap.size,
      conversationCacheEntries: this.conversationCache.size,
    });
  }

  /**
   * Check rate limit for a user
   * @returns {boolean} true if within limit, false if rate limited
   */
  checkRateLimit(userId) {
    const now = Date.now();
    const userIdStr = String(userId);

    if (!this.rateLimitMap.has(userIdStr)) {
      this.rateLimitMap.set(userIdStr, { windowStart: now, count: 1 });
      return true;
    }

    const userData = this.rateLimitMap.get(userIdStr);

    // Reset window if expired
    if (now - userData.windowStart > RATE_LIMIT_WINDOW_MS) {
      userData.windowStart = now;
      userData.count = 1;
      return true;
    }

    // Check if within limit
    if (userData.count >= RATE_LIMIT_MAX_REQUESTS) {
      logger.warn('Rate limit exceeded', { userId: userIdStr, count: userData.count });
      return false;
    }

    userData.count++;
    return true;
  }

  /**
   * Parse authorized users from environment variables
   */
  parseAuthorizedUsers() {
    const users = {};

    if (process.env.TELEGRAM_CHAT_ID_NELSON) {
      users.nelson = String(process.env.TELEGRAM_CHAT_ID_NELSON);
    }
    if (process.env.TELEGRAM_CHAT_ID_NICK) {
      users.nick = String(process.env.TELEGRAM_CHAT_ID_NICK);
    }
    if (process.env.TELEGRAM_GROUP_CHAT_ID) {
      users.group = String(process.env.TELEGRAM_GROUP_CHAT_ID);
    }

    // Also parse any additional authorized users from comma-separated list
    if (process.env.TELEGRAM_AUTHORIZED_USERS) {
      const additionalUsers = process.env.TELEGRAM_AUTHORIZED_USERS.split(',');
      additionalUsers.forEach((id, index) => {
        const trimmedId = id.trim();
        if (trimmedId) {
          users[`user_${index}`] = trimmedId;
        }
      });
    }

    return users;
  }

  /**
   * Check if user is authorized
   * Checks both chat ID (for groups) and user ID (for private chats)
   */
  isAuthorized(chatId, userId = null) {
    const chatIdStr = String(chatId);
    const userIdStr = userId ? String(userId) : null;

    const authorizedIds = Object.values(this.authorizedUsers).filter(Boolean);

    const isAuth = authorizedIds.some((authId) => {
      return authId === chatIdStr || (userIdStr && authId === userIdStr);
    });

    if (!isAuth) {
      logger.warn('Unauthorized Telegram access attempt', {
        chatId: chatIdStr,
        userId: userIdStr || 'not provided',
      });
    }

    return isAuth;
  }

  /**
   * Get user identifier from chat ID
   */
  getUserId(chatId, fromId = null) {
    const chatIdStr = String(chatId);
    const fromIdStr = fromId ? String(fromId) : null;

    for (const [name, id] of Object.entries(this.authorizedUsers)) {
      if (id === chatIdStr || id === fromIdStr) {
        return name;
      }
    }

    return fromIdStr || chatIdStr;
  }

  /**
   * Get conversation cache for user
   */
  getConversationCache(userId) {
    if (!this.conversationCache.has(userId)) {
      this.conversationCache.set(userId, []);
    }
    return this.conversationCache.get(userId);
  }

  /**
   * Add message to conversation cache
   */
  addToConversationCache(userId, role, content) {
    const cache = this.getConversationCache(userId);
    cache.push({ role, content });

    // Keep only last N messages
    while (cache.length > this.maxCacheMessages) {
      cache.shift();
    }
  }

  /**
   * Clear conversation cache for user
   */
  clearConversationCache(userId) {
    this.conversationCache.set(userId, []);
  }

  /**
   * Initialize bot handlers
   */
  initializeHandlers() {
    // Start command
    this.bot.start(async (ctx) => {
      const userId = ctx.from?.id;
      if (!this.isAuthorized(ctx.chat.id, userId)) {
        await ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
        return;
      }

      const userName = this.getUserId(ctx.chat.id, userId);
      this.clearConversationCache(userName);

      await ctx.reply(
        `Hello! I'm your Signature Cleans CRM assistant.\n\n` +
          `I can help you with:\n` +
          `• Finding leads, contacts, and deals\n` +
          `• Creating new leads and opportunities\n` +
          `• Checking pipeline status and metrics\n` +
          `• Sending follow-up emails\n` +
          `• Creating tasks and reminders\n` +
          `• And much more!\n\n` +
          `Just tell me what you need in plain English. For example:\n` +
          `"Find the Sudlow deal"\n` +
          `"Create a lead for ABC Cleaning Ltd"\n` +
          `"Show me stale deals"\n` +
          `"What's our pipeline looking like?"\n\n` +
          `You can also send voice messages - I'll transcribe and process them.\n\n` +
          `Type /help for more information.`
      );
    });

    // Help command
    this.bot.help(async (ctx) => {
      const userId = ctx.from?.id;
      if (!this.isAuthorized(ctx.chat.id, userId)) {
        await ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
        return;
      }

      await ctx.reply(
        `CRM Assistant Commands:\n\n` +
          `/start - Start fresh conversation\n` +
          `/help - Show this help\n` +
          `/clear - Clear conversation history\n` +
          `/pipeline - Quick pipeline summary\n` +
          `/stale - Show stale deals\n` +
          `/metrics - Sales metrics overview\n\n` +
          `Or just type naturally:\n` +
          `• "Find John at ABC Company"\n` +
          `• "New lead: XYZ Ltd, contact Sarah, 07700900123"\n` +
          `• "Move the Sudlow deal to Negotiation"\n` +
          `• "Remind me to call Sarah tomorrow"\n` +
          `• "Send a follow-up email to the Vistry contact"\n` +
          `• "What's our forecast for this month?"\n\n` +
          `Send voice notes for hands-free operation!`
      );
    });

    // Clear command
    this.bot.command('clear', async (ctx) => {
      const userId = ctx.from?.id;
      if (!this.isAuthorized(ctx.chat.id, userId)) {
        return;
      }

      const userName = this.getUserId(ctx.chat.id, userId);
      this.clearConversationCache(userName);
      await ctx.reply('Conversation cleared. Starting fresh!');
    });

    // Pipeline command
    this.bot.command('pipeline', async (ctx) => {
      await this.handleTextMessage(ctx, 'Give me a pipeline summary');
    });

    // Stale command
    this.bot.command('stale', async (ctx) => {
      await this.handleTextMessage(ctx, 'Show me stale deals that need attention');
    });

    // Metrics command
    this.bot.command('metrics', async (ctx) => {
      await this.handleTextMessage(ctx, 'Show me our sales metrics');
    });

    // Text messages
    this.bot.on('text', (ctx) => this.handleTextMessage(ctx));

    // Voice messages
    this.bot.on('voice', (ctx) => this.handleVoiceMessage(ctx));

    // Callback queries (for inline buttons)
    this.bot.on('callback_query', (ctx) => this.handleCallbackQuery(ctx));

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error('Telegram bot error', { error: err.message, stack: err.stack });
      ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {});
    });
  }

  /**
   * Handle text messages
   */
  async handleTextMessage(ctx, overrideMessage = null) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    // Validate context
    if (!chatId) {
      logger.warn('Missing chat ID in context');
      return;
    }

    // Authorization check
    if (!this.isAuthorized(chatId, userId)) {
      await ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
      return;
    }

    // Rate limiting check
    if (!this.checkRateLimit(userId || chatId)) {
      await ctx.reply('You are sending too many messages. Please wait a moment before trying again.');
      return;
    }

    const userName = this.getUserId(chatId, userId);
    const message = overrideMessage || ctx.message?.text || '';

    // Validate message
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    // Truncate extremely long messages
    const maxMessageLength = 5000;
    const truncatedMessage = trimmedMessage.slice(0, maxMessageLength);

    logger.info('Processing text message', {
      user: userName,
      messageLength: truncatedMessage.length,
      preview: truncatedMessage.substring(0, 50)
    });

    try {
      // Show typing indicator
      await ctx.sendChatAction('typing').catch(() => {});

      // Get conversation history
      const sessionMessages = this.getConversationCache(userName);

      // Process with AI agent
      const result = await conversationAgent.processMessage(truncatedMessage, {
        userId: userName,
        chatId,
        sessionMessages,
      });

      // Add to conversation cache
      this.addToConversationCache(userName, 'user', truncatedMessage);
      this.addToConversationCache(userName, 'assistant', result.response);

      // Log conversation (don't await to avoid blocking response)
      conversationAgent.logConversation(
        userName,
        truncatedMessage,
        result.response,
        result.toolsUsed || [],
        result.duration,
        result.success
      ).catch(err => logger.error('Failed to log conversation', { error: err.message }));

      // Send response (split if too long)
      await this.sendLongMessage(ctx, result.response);
    } catch (error) {
      logger.error('Error handling text message', {
        error: error.message,
        stack: error.stack,
        user: userName
      });

      // Provide user-friendly error message
      let errorMessage = 'Sorry, I encountered an error processing your request. Please try again.';
      if (error.message?.includes('rate limit')) {
        errorMessage = 'The AI service is temporarily busy. Please wait a moment and try again.';
      }

      await ctx.reply(errorMessage).catch(() => {});
    }
  }

  /**
   * Handle voice messages
   */
  async handleVoiceMessage(ctx) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    // Validate context
    if (!chatId) {
      logger.warn('Missing chat ID in voice message context');
      return;
    }

    // Authorization check
    if (!this.isAuthorized(chatId, userId)) {
      await ctx.reply('Sorry, I can only help authorized Signature Cleans team members.');
      return;
    }

    // Rate limiting check
    if (!this.checkRateLimit(userId || chatId)) {
      await ctx.reply('You are sending too many messages. Please wait a moment before trying again.');
      return;
    }

    const userName = this.getUserId(chatId, userId);

    if (!openaiService.isConfigured()) {
      await ctx.reply(
        'Voice messages are not available - OpenAI API key not configured. Please send text messages instead.'
      );
      return;
    }

    try {
      // Validate voice message
      const voice = ctx.message?.voice;
      if (!voice || !voice.file_id) {
        await ctx.reply('Invalid voice message. Please try again.');
        return;
      }

      // Check file size (Telegram provides duration in seconds)
      const durationSeconds = voice.duration || 0;
      if (durationSeconds > 300) { // 5 minutes max
        await ctx.reply('Voice message is too long (max 5 minutes). Please send a shorter message.');
        return;
      }

      // Estimate file size from duration (rough estimate)
      const estimatedSizeMB = (voice.file_size || 0) / (1024 * 1024);
      if (estimatedSizeMB > VOICE_MAX_SIZE_MB) {
        await ctx.reply(`Voice file is too large (max ${VOICE_MAX_SIZE_MB}MB). Please send a shorter message.`);
        return;
      }

      logger.info('Processing voice message', {
        user: userName,
        duration: durationSeconds,
        estimatedSizeMB: estimatedSizeMB.toFixed(2)
      });

      // Show typing indicator
      await ctx.sendChatAction('typing').catch(() => {});
      await ctx.reply('Transcribing your voice message...');

      // Get file info
      const fileLink = await ctx.telegram.getFileLink(voice.file_id);

      // Download the audio file with timeout
      const response = await axios.get(fileLink.href, {
        responseType: 'arraybuffer',
        timeout: VOICE_DOWNLOAD_TIMEOUT_MS,
        maxContentLength: VOICE_MAX_SIZE_MB * 1024 * 1024,
      });

      const audioBuffer = Buffer.from(response.data);

      // Validate buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        await ctx.reply('Failed to download voice message. Please try again.');
        return;
      }

      // Transcribe with Whisper
      const transcription = await openaiService.transcribeAudio(audioBuffer, 'voice.ogg');

      if (!transcription || transcription.trim().length === 0) {
        await ctx.reply("Sorry, I couldn't understand the audio. Please try again or send a text message.");
        return;
      }

      const trimmedTranscription = transcription.trim().slice(0, 5000); // Limit transcription length

      logger.info('Voice transcribed', {
        user: userName,
        transcriptionLength: trimmedTranscription.length,
        preview: trimmedTranscription.substring(0, 50)
      });

      // Show what was transcribed
      const displayTranscription = trimmedTranscription.length > 200
        ? trimmedTranscription.substring(0, 200) + '...'
        : trimmedTranscription;
      await ctx.reply(`"${displayTranscription}"\n\nProcessing...`);

      // Process as text message
      await this.handleTextMessage(ctx, trimmedTranscription);
    } catch (error) {
      logger.error('Error handling voice message', {
        error: error.message,
        stack: error.stack,
        user: userName
      });

      let errorMessage = 'Sorry, I had trouble processing your voice message. Please try again or send a text message.';
      if (error.message?.includes('timeout')) {
        errorMessage = 'The voice message download timed out. Please try a shorter message.';
      } else if (error.message?.includes('too large')) {
        errorMessage = 'The voice message is too large. Please send a shorter message.';
      }

      await ctx.reply(errorMessage).catch(() => {});
    }
  }

  /**
   * Handle callback queries (inline button presses)
   */
  async handleCallbackQuery(ctx) {
    const userId = ctx.from?.id;
    if (!this.isAuthorized(ctx.chat?.id || userId, userId)) {
      await ctx.answerCbQuery('Not authorized');
      return;
    }

    try {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();

      // Handle different callback actions
      if (data.startsWith('approve_email:')) {
        const approvalId = data.split(':')[1];
        await this.handleTextMessage(ctx, `Approve email ${approvalId}`);
      } else if (data.startsWith('reject_email:')) {
        const approvalId = data.split(':')[1];
        await this.handleTextMessage(ctx, `Reject email ${approvalId}`);
      } else if (data.startsWith('view_deal:')) {
        const dealId = data.split(':')[1];
        await this.handleTextMessage(ctx, `Show me details for deal ${dealId}`);
      }
    } catch (error) {
      logger.error('Error handling callback query', { error: error.message });
      await ctx.answerCbQuery('Error processing request');
    }
  }

  /**
   * Send a long message, splitting if necessary
   */
  async sendLongMessage(ctx, text, maxLength = 4000) {
    if (text.length <= maxLength) {
      await ctx.reply(text);
      return;
    }

    // Split by paragraphs first
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length + 2 > maxLength) {
        if (currentChunk) {
          await ctx.reply(currentChunk.trim());
          currentChunk = '';
        }

        // If single paragraph is too long, split by lines
        if (paragraph.length > maxLength) {
          const lines = paragraph.split('\n');
          for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxLength) {
              if (currentChunk) {
                await ctx.reply(currentChunk.trim());
                currentChunk = '';
              }
            }
            currentChunk += line + '\n';
          }
        } else {
          currentChunk = paragraph + '\n\n';
        }
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }

    if (currentChunk.trim()) {
      await ctx.reply(currentChunk.trim());
    }
  }

  /**
   * Send a proactive message to a user
   */
  async sendProactiveMessage(chatId, message) {
    try {
      await this.bot.telegram.sendMessage(chatId, message);
      logger.info('Proactive message sent', { chatId: String(chatId).substring(0, 6) });
    } catch (error) {
      logger.error('Failed to send proactive message', { error: error.message, chatId });
    }
  }

  /**
   * Send a message to Nelson (primary user)
   */
  async sendToNelson(message) {
    const nelsonChatId = process.env.TELEGRAM_CHAT_ID_NELSON;
    if (nelsonChatId) {
      await this.sendProactiveMessage(nelsonChatId, message);
    }
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
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear caches
    this.rateLimitMap.clear();
    this.conversationCache.clear();

    await this.bot.stop();
    logger.info('Telegram bot stopped');
  }
}

module.exports = TelegramHandler;
