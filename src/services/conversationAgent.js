/**
 * Conversation Agent
 * Production-ready conversational AI agent for CRM operations
 * Uses OpenAI with function calling for reliable, natural interactions
 * Enterprise-grade with comprehensive error handling and validation
 */

const openaiService = require('./openaiService');
const { TOOL_DEFINITIONS, executeTool } = require('./crmTools');
const db = require('../db/connection');
const logger = require('../utils/logger');

// Configuration
const MAX_TOOL_CALLS = 5; // Maximum tool calls per turn to prevent infinite loops
const MAX_MESSAGE_LENGTH = 10000; // Maximum user message length
const MAX_CONTEXT_MESSAGES = 10; // Maximum context messages to include

// System prompt that defines the agent's personality and capabilities
const SYSTEM_PROMPT = `You are the AI assistant for Signature Cleans, a commercial cleaning company based in the UK. You help the sales team manage their CRM (Zoho CRM) through natural conversation.

Your personality:
- Professional but friendly and approachable
- Efficient and action-oriented - you do things, not just describe them
- Proactive - you suggest next steps and offer to help with related tasks
- You use British English spellings and currency (£)

Your capabilities:
- Search for leads, contacts, and deals in the CRM
- Create and update leads and deals
- View pipeline summaries and sales metrics
- Track stale deals that need follow-up
- Create tasks and reminders
- Send emails (with approval for high-value deals)
- Start/stop automated quote follow-up sequences
- Log calls and activities

Guidelines:
- When the user mentions a company or person, search for them first before taking action
- When creating leads, always check for duplicates first
- Be concise but informative in your responses
- Use simple formatting with line breaks for readability (not markdown headers)
- When showing lists, use bullet points (•) or numbered lists
- For monetary values, always use £ symbol
- When you complete an action, confirm what you did and offer related next steps
- If you need more information to complete a task, ask for it specifically
- If an operation fails, explain what went wrong and suggest alternatives

Context handling:
- Remember the context of the conversation
- If the user refers to "them", "that deal", "the lead", etc., use the context from previous messages
- You can reference records found or created in earlier messages

Current date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;

class ConversationAgent {
  constructor() {
    this.maxToolCalls = MAX_TOOL_CALLS;
  }

  /**
   * Sanitize user input to prevent injection attacks
   * @param {string} input - Raw user input
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Truncate if too long
    let sanitized = input.slice(0, MAX_MESSAGE_LENGTH);

    // Remove null bytes and other problematic characters
    sanitized = sanitized.replace(/\0/g, '');

    return sanitized.trim();
  }

  /**
   * Safely parse JSON with error handling
   * @param {string} jsonString - JSON string to parse
   * @param {string} context - Context for error logging
   * @returns {object|null} Parsed object or null on failure
   */
  safeJsonParse(jsonString, context = 'JSON parse') {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error(`${context} failed`, {
        error: error.message,
        input: jsonString?.substring(0, 100)
      });
      return null;
    }
  }

  /**
   * Process a user message and generate a response
   * @param {string} message - User's message
   * @param {object} context - User context including session data
   * @returns {Promise<object>} Response with message and metadata
   */
  async processMessage(message, context = {}) {
    const startTime = Date.now();
    const { userId, chatId, sessionMessages = [] } = context;

    // Sanitize input
    const sanitizedMessage = this.sanitizeInput(message);
    if (!sanitizedMessage) {
      return {
        success: false,
        response: "I didn't receive a message. Please try again.",
        error: 'Empty message',
        duration: Date.now() - startTime,
      };
    }

    try {
      // Build conversation messages with sanitized context
      const contextMessages = sessionMessages
        .slice(-MAX_CONTEXT_MESSAGES)
        .map(msg => ({
          role: msg.role,
          content: this.sanitizeInput(msg.content) || '',
        }))
        .filter(msg => msg.content);

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...contextMessages,
        { role: 'user', content: sanitizedMessage },
      ];

      // Process with potential tool calls
      const result = await this.processWithTools(messages, context);

      const duration = Date.now() - startTime;
      logger.info('Conversation processed', {
        userId,
        duration,
        toolsUsed: result.toolsUsed?.map(t => t.name) || [],
      });

      return {
        success: true,
        response: result.response,
        toolsUsed: result.toolsUsed || [],
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Conversation processing failed', {
        error: error.message,
        stack: error.stack,
        userId
      });

      // User-friendly error messages
      let userMessage = 'I encountered an error processing your request. Please try again.';

      if (error.message.includes('rate limit') || error.status === 429) {
        userMessage = "I'm receiving too many requests right now. Please wait a moment and try again.";
      } else if (error.message.includes('API key')) {
        userMessage = 'There is a configuration issue. Please contact support.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'The request took too long. Please try a simpler query.';
      }

      return {
        success: false,
        response: userMessage,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Process messages with tool calling support
   * @param {array} messages - Conversation messages
   * @param {object} context - User context
   * @returns {Promise<object>} Response and metadata
   */
  async processWithTools(messages, context) {
    const toolsUsed = [];
    let currentMessages = [...messages];
    let iterations = 0;

    while (iterations < this.maxToolCalls) {
      iterations++;

      // Get completion from OpenAI
      const completion = await openaiService.createChatCompletion(
        currentMessages,
        TOOL_DEFINITIONS,
        'auto'
      );

      const assistantMessage = completion.message;

      // Validate assistant message
      if (!assistantMessage) {
        throw new Error('No response received from AI');
      }

      // If no tool calls, we have the final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return {
          response: assistantMessage.content || "I'm not sure how to help with that. Could you please rephrase?",
          toolsUsed,
        };
      }

      // Process tool calls
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function?.name;
        const functionArgsRaw = toolCall.function?.arguments;

        // Validate tool call structure
        if (!functionName || !functionArgsRaw) {
          logger.warn('Invalid tool call structure', { toolCall });
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: false, error: 'Invalid tool call' }),
          });
          continue;
        }

        // Safely parse function arguments
        const functionArgs = this.safeJsonParse(functionArgsRaw, `Tool ${functionName} args`);
        if (functionArgs === null) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: false, error: 'Failed to parse tool arguments' }),
          });
          continue;
        }

        logger.debug('Executing tool', { function: functionName, args: functionArgs });

        // Execute the tool with error handling
        let toolResult;
        try {
          toolResult = await executeTool(functionName, functionArgs, context);
        } catch (toolError) {
          logger.error('Tool execution error', {
            tool: functionName,
            error: toolError.message
          });
          toolResult = { success: false, error: toolError.message };
        }

        toolsUsed.push({ name: functionName, args: functionArgs, result: toolResult });

        // Add tool result to messages
        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    // If we hit max iterations, get a final response
    logger.warn('Hit max tool call iterations', { iterations: this.maxToolCalls });

    const finalCompletion = await openaiService.createChatCompletion(
      currentMessages,
      null, // No tools for final response
      'none'
    );

    return {
      response: finalCompletion.message?.content || "I've completed the requested operations.",
      toolsUsed,
    };
  }

  /**
   * Get or create a session for the user
   * @param {string} userId - User identifier
   * @returns {Promise<object>} Session data
   */
  async getSession(userId) {
    if (!userId) {
      return { user_id: 'anonymous', mentioned_entities: {}, last_search_results: {} };
    }

    try {
      const result = await db.query(
        'SELECT * FROM session_state WHERE user_id = $1',
        [String(userId)]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create new session
      const newSession = await db.query(
        `INSERT INTO session_state (user_id, mentioned_entities, last_search_results)
         VALUES ($1, '{}', '{}')
         RETURNING *`,
        [String(userId)]
      );

      return newSession.rows[0];
    } catch (error) {
      logger.error('Failed to get/create session', { error: error.message, userId });
      return { user_id: userId, mentioned_entities: {}, last_search_results: {} };
    }
  }

  /**
   * Update session with new context
   * @param {string} userId - User identifier
   * @param {object} updates - Session updates
   */
  async updateSession(userId, updates) {
    if (!userId) return;

    try {
      const setClause = [];
      const values = [String(userId)];
      let paramIndex = 2;

      if (updates.current_record_id !== undefined) {
        setClause.push(`current_record_id = $${paramIndex++}`);
        values.push(String(updates.current_record_id || ''));
      }
      if (updates.current_record_module !== undefined) {
        setClause.push(`current_record_module = $${paramIndex++}`);
        values.push(String(updates.current_record_module || ''));
      }
      if (updates.current_record_name !== undefined) {
        setClause.push(`current_record_name = $${paramIndex++}`);
        values.push(String(updates.current_record_name || ''));
      }
      if (updates.mentioned_entities !== undefined) {
        setClause.push(`mentioned_entities = $${paramIndex++}`);
        values.push(JSON.stringify(updates.mentioned_entities || {}));
      }
      if (updates.last_search_results !== undefined) {
        setClause.push(`last_search_results = $${paramIndex++}`);
        values.push(JSON.stringify(updates.last_search_results || {}));
      }

      if (setClause.length > 0) {
        setClause.push('updated_at = CURRENT_TIMESTAMP');
        await db.query(
          `UPDATE session_state SET ${setClause.join(', ')} WHERE user_id = $1`,
          values
        );
      }
    } catch (error) {
      logger.error('Failed to update session', { error: error.message, userId });
    }
  }

  /**
   * Get recent conversation history for context
   * @param {string} userId - User identifier
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<array>} Recent messages
   */
  async getConversationHistory(userId, limit = 10) {
    if (!userId) return [];

    try {
      const result = await db.query(
        `SELECT user_message, agent_response
         FROM conversations
         WHERE user_id = $1 AND success = true
         ORDER BY created_at DESC
         LIMIT $2`,
        [String(userId), Math.min(limit, 50)] // Cap at 50 for safety
      );

      // Convert to message format and reverse to chronological order
      const messages = [];
      for (const row of result.rows.reverse()) {
        if (row.user_message) {
          messages.push({ role: 'user', content: row.user_message });
        }
        if (row.agent_response) {
          messages.push({ role: 'assistant', content: row.agent_response });
        }
      }

      return messages;
    } catch (error) {
      logger.error('Failed to get conversation history', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Log a conversation turn
   * @param {string} userId - User identifier
   * @param {string} userMessage - User's message
   * @param {string} agentResponse - Agent's response
   * @param {array} toolsUsed - Tools that were called
   * @param {number} duration - Processing time in ms
   * @param {boolean} success - Whether the request succeeded
   */
  async logConversation(userId, userMessage, agentResponse, toolsUsed, duration, success) {
    try {
      // Truncate long messages for database storage
      const maxDbLength = 10000;
      const truncatedUserMessage = userMessage?.slice(0, maxDbLength) || '';
      const truncatedResponse = agentResponse?.slice(0, maxDbLength) || '';

      await db.query(
        `INSERT INTO conversations
         (user_id, channel, message_type, user_message, agent_response, intent_detected, tools_called, response_time_ms, success)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          String(userId || 'anonymous'),
          'telegram',
          'text',
          truncatedUserMessage,
          truncatedResponse,
          toolsUsed?.length > 0 ? toolsUsed[0].name : 'conversation',
          toolsUsed?.map(t => t.name) || [],
          Math.round(duration) || 0,
          Boolean(success),
        ]
      );
    } catch (error) {
      logger.error('Failed to log conversation', { error: error.message });
    }
  }
}

module.exports = new ConversationAgent();
