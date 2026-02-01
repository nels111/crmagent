/**
 * Conversation Agent
 * Production-ready conversational AI agent for CRM operations
 * Uses OpenAI with function calling for reliable, natural interactions
 */

const openaiService = require('./openaiService');
const { TOOL_DEFINITIONS, executeTool } = require('./crmTools');
const db = require('../db/connection');
const logger = require('../utils/logger');

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
    this.maxToolCalls = 5; // Maximum tool calls per turn to prevent infinite loops
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

    try {
      // Build conversation messages
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...sessionMessages.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: message },
      ];

      // Process with potential tool calls
      const result = await this.processWithTools(messages, context);

      const duration = Date.now() - startTime;
      logger.info('Conversation processed', {
        userId,
        duration,
        toolsUsed: result.toolsUsed,
      });

      return {
        success: true,
        response: result.response,
        toolsUsed: result.toolsUsed,
        duration,
      };
    } catch (error) {
      logger.error('Conversation processing failed', { error: error.message, userId });

      return {
        success: false,
        response: `I encountered an error processing your request: ${error.message}. Please try again or rephrase your request.`,
        error: error.message,
        duration: Date.now() - startTime,
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
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        logger.debug('Executing tool', { function: functionName, args: functionArgs });

        // Execute the tool
        const toolResult = await executeTool(functionName, functionArgs, context);
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
    const finalCompletion = await openaiService.createChatCompletion(
      currentMessages,
      null, // No tools for final response
      'none'
    );

    return {
      response: finalCompletion.message.content || "I've completed the requested operations.",
      toolsUsed,
    };
  }

  /**
   * Get or create a session for the user
   * @param {string} userId - User identifier
   * @returns {Promise<object>} Session data
   */
  async getSession(userId) {
    try {
      const result = await db.query(
        'SELECT * FROM session_state WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create new session
      const newSession = await db.query(
        `INSERT INTO session_state (user_id, mentioned_entities, last_search_results)
         VALUES ($1, '{}', '{}')
         RETURNING *`,
        [userId]
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
    try {
      const setClause = [];
      const values = [userId];
      let paramIndex = 2;

      if (updates.current_record_id !== undefined) {
        setClause.push(`current_record_id = $${paramIndex++}`);
        values.push(updates.current_record_id);
      }
      if (updates.current_record_module !== undefined) {
        setClause.push(`current_record_module = $${paramIndex++}`);
        values.push(updates.current_record_module);
      }
      if (updates.current_record_name !== undefined) {
        setClause.push(`current_record_name = $${paramIndex++}`);
        values.push(updates.current_record_name);
      }
      if (updates.mentioned_entities !== undefined) {
        setClause.push(`mentioned_entities = $${paramIndex++}`);
        values.push(JSON.stringify(updates.mentioned_entities));
      }
      if (updates.last_search_results !== undefined) {
        setClause.push(`last_search_results = $${paramIndex++}`);
        values.push(JSON.stringify(updates.last_search_results));
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
    try {
      const result = await db.query(
        `SELECT user_message, agent_response
         FROM conversations
         WHERE user_id = $1 AND success = true
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
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
      await db.query(
        `INSERT INTO conversations
         (user_id, channel, message_type, user_message, agent_response, intent_detected, tools_called, response_time_ms, success)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          'telegram',
          'text',
          userMessage,
          agentResponse,
          toolsUsed.length > 0 ? toolsUsed[0].name : 'conversation',
          toolsUsed.map(t => t.name),
          duration,
          success,
        ]
      );
    } catch (error) {
      logger.error('Failed to log conversation', { error: error.message });
    }
  }
}

module.exports = new ConversationAgent();
