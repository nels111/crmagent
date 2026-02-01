/**
 * OpenAI Service
 * Handles all OpenAI API interactions including chat completions and Whisper transcription
 */

const OpenAI = require('openai');
const { Readable } = require('stream');
const logger = require('../utils/logger');

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
      });
    }
    return this.client;
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

    try {
      const params = {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      };

      if (tools && tools.length > 0) {
        params.tools = tools;
        params.tool_choice = toolChoice;
      }

      const response = await client.chat.completions.create(params);
      return response.choices[0];
    } catch (error) {
      logger.error('OpenAI chat completion failed', { error: error.message });
      throw error;
    }
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

    try {
      // Convert buffer to a readable stream with file-like properties
      const stream = Readable.from(audioBuffer);
      stream.path = filename;

      const response = await client.audio.transcriptions.create({
        file: stream,
        model: 'whisper-1',
        language: 'en',
      });

      return response.text;
    } catch (error) {
      logger.error('Whisper transcription failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if API key is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }
}

module.exports = new OpenAIService();
