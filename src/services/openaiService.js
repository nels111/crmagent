/**
 * OpenAI Service
 * Handles all OpenAI API interactions including chat completions and Whisper transcription
 * Enterprise-grade with retry logic, timeouts, and error handling
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

class OpenAIService {
  constructor() {
    this.client = null;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  /**
   * Get or create the OpenAI client (lazy initialization)
   */
  getClient() {
    if (!this.client && process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: MAX_RETRIES,
      });
    }
    return this.client;
  }

  /**
   * Sleep helper for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with retry logic
   */
  async withRetry(operation, operationName) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on authentication or invalid request errors
        if (error.status === 401 || error.status === 400) {
          throw error;
        }

        // Don't retry on rate limit if we've exhausted retries
        if (error.status === 429 && attempt === MAX_RETRIES) {
          throw error;
        }

        logger.warn(`${operationName} failed, attempt ${attempt}/${MAX_RETRIES}`, {
          error: error.message,
          status: error.status,
        });

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Create a chat completion with function calling
   * @param {array} messages - Conversation messages
   * @param {array} tools - Available tools/functions
   * @param {string} toolChoice - Tool choice strategy
   * @returns {Promise<object>} Completion response
   */
  async createChatCompletion(messages, tools = null, toolChoice = 'auto') {
    const client = this.getClient();
    if (!client) {
      throw new Error('OpenAI API key not configured');
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }

    // Sanitize messages - remove any null/undefined content
    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: msg.content || '',
    }));

    return await this.withRetry(async () => {
      const params = {
        model: this.model,
        messages: sanitizedMessages,
        temperature: 0.7,
        max_tokens: 1500,
      };

      if (tools && tools.length > 0) {
        params.tools = tools;
        params.tool_choice = toolChoice;
      }

      const response = await client.chat.completions.create(params);

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response choices returned from OpenAI');
      }

      return response.choices[0];
    }, 'Chat completion');
  }

  /**
   * Transcribe audio using Whisper
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} filename - Original filename
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioBuffer, filename = 'audio.ogg') {
    const client = this.getClient();
    if (!client) {
      throw new Error('OpenAI API key not configured');
    }

    // Validate buffer
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty');
    }

    // Check file size (max 25MB for Whisper)
    const maxSize = 25 * 1024 * 1024;
    if (audioBuffer.length > maxSize) {
      throw new Error('Audio file too large (max 25MB)');
    }

    // Write buffer to temp file (OpenAI SDK requires file path or stream with path)
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `whisper_${Date.now()}_${filename}`);

    try {
      // Write the buffer to a temp file
      fs.writeFileSync(tempFilePath, audioBuffer);

      return await this.withRetry(async () => {
        const response = await client.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          language: 'en',
        });

        return response.text || '';
      }, 'Audio transcription');
    } finally {
      // Clean up temp file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp audio file', { error: cleanupError.message });
      }
    }
  }

  /**
   * Check if API key is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Validate API key by making a simple request
   * @returns {Promise<boolean>}
   */
  async validateApiKey() {
    try {
      const client = this.getClient();
      if (!client) return false;

      // Make a minimal request to validate the key
      await client.models.list();
      return true;
    } catch (error) {
      // Only treat authentication errors as invalid key
      // Network errors should not fail validation
      if (error.status === 401) {
        logger.error('OpenAI API key is invalid (401 Unauthorized)', { error: error.message });
        return false;
      }
      if (error.status === 403) {
        logger.error('OpenAI API key lacks permissions (403 Forbidden)', { error: error.message });
        return false;
      }

      // For connection errors or other issues, assume key is valid
      // The actual errors will be caught when making real requests
      logger.warn('OpenAI API validation inconclusive (may be network issue)', {
        error: error.message,
        status: error.status
      });
      return true;
    }
  }
}

module.exports = new OpenAIService();
