# CLAUDE.md - AI Assistant Guide for Signature Cleans CRM Agent

This document provides essential context for AI assistants working with the Signature Cleans CRM Agent codebase.

## Project Overview

**Signature Cleans CRM Agent** is a production-ready conversational AI agent for CRM operations, built with Node.js and powered by OpenAI GPT-4o. It provides:

- **Conversational AI Interface** - Natural language understanding via OpenAI with function calling
- **Zoho CRM Integration** - Full CRUD operations for leads, contacts, deals, tasks
- **Telegram Bot Interface** - Text and voice message support via Whisper transcription
- **Autonomous Operations** - Scheduled quote follow-ups, pipeline briefings, stale deal alerts
- **Multi-turn Context** - Maintains conversation history for contextual interactions

**Author:** Nelson Iseguan - Signature Cleans
**Tech Stack:** Node.js, Express, PostgreSQL, Telegraf, OpenAI (GPT-4o + Whisper), Zoho CRM API

## Architecture Overview

```
User (Telegram) → TelegramHandler → ConversationAgent → OpenAI GPT-4o
                                           ↓
                                    CRM Tools (Function Calling)
                                           ↓
                        ┌──────────────────┼──────────────────┐
                        ↓                  ↓                  ↓
                   ZohoService     EmailService         Database
                   (CRM CRUD)      (Templates)         (State/Logs)
```

## Codebase Structure

```
src/
├── index.js                      # Application entry point, orchestrates startup
├── db/
│   ├── connection.js             # PostgreSQL connection pool and initialization
│   └── init.sql                  # Database schema reference
├── handlers/
│   └── telegramHandler.js        # Telegram bot with voice/text support
├── services/
│   ├── openaiService.js          # OpenAI client (GPT-4o + Whisper)
│   ├── conversationAgent.js      # Main AI agent with function calling
│   ├── crmTools.js               # CRM operations as callable tools
│   ├── zohoService.js            # Zoho CRM API wrapper
│   ├── advancedCrmService.js     # Pipeline analytics, forecasting
│   ├── emailService.js           # Email templates and approval workflow
│   └── aiAgentCore.js            # Legacy intent-based agent (deprecated)
├── tasks/
│   └── autonomousScheduler.js    # Cron-based scheduled tasks
└── utils/
    └── logger.js                 # Centralized logging utility
```

## Key Components

### Conversation Agent (`conversationAgent.js`)
The heart of the system - processes natural language using OpenAI with function calling:
- Maintains conversation context across multiple turns
- Executes CRM operations via tool functions
- Handles up to 5 sequential tool calls per request
- Logs all conversations to database

### CRM Tools (`crmTools.js`)
Defines 16 callable functions for OpenAI function calling:
- `search_crm` - Search leads, contacts, deals
- `create_lead` / `update_lead` - Lead management
- `create_deal` / `update_deal` - Deal management
- `get_pipeline_summary` - Pipeline overview with health metrics
- `get_stale_deals` - Deals needing attention
- `get_revenue_forecast` - Revenue projections
- `get_sales_metrics` - Performance analytics
- `create_task` - Create reminders with natural language dates
- `send_email` - Send/queue emails with approval workflow
- `start_quote_sequence` / `stop_quote_sequence` - Automated follow-ups
- `log_activity` - Record calls, meetings, notes
- `get_record_details` - Full record information
- `add_tags` - Tag management

### OpenAI Service (`openaiService.js`)
Handles all OpenAI API interactions:
- Chat completions with function calling (GPT-4o)
- Voice transcription (Whisper)
- Lazy client initialization
- Configurable model via `OPENAI_MODEL` env var

### Telegram Handler (`telegramHandler.js`)
User interface layer:
- Commands: `/start`, `/help`, `/clear`, `/pipeline`, `/stale`, `/metrics`
- Natural language text messages
- Voice message transcription and processing
- In-memory conversation cache (last 20 messages per user)
- Long message splitting for Telegram limits

## Development Commands

```bash
# Install dependencies
npm install

# Run in production
npm start

# Run in development
npm run dev

# Enable debug logging
LOG_LEVEL=debug npm start
```

## Environment Variables

**Required:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token |
| `TELEGRAM_CHAT_ID_NELSON` | Primary authorized user chat ID |
| `ZOHO_CLIENT_ID` | Zoho OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth client secret |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth refresh token |
| `ZOHO_DATACENTER` | Zoho datacenter region (`eu`) |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o and Whisper |

**Optional:**

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o` |
| `TELEGRAM_CHAT_ID_NICK` | Additional authorized user | - |
| `TELEGRAM_GROUP_CHAT_ID` | Group chat for notifications | - |
| `TELEGRAM_AUTHORIZED_USERS` | Comma-separated additional user IDs | - |
| `NODE_ENV` | Environment | `development` |
| `PORT` | HTTP server port | `3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `APPROVAL_REQUIRED_DEAL_VALUE` | Email approval threshold | `5000` |
| `PROTECTED_ACCOUNTS` | Accounts requiring approval | - |

## Code Patterns

### Adding a New CRM Tool
1. Add tool definition to `TOOL_DEFINITIONS` in `crmTools.js`:
```javascript
{
  type: 'function',
  function: {
    name: 'tool_name',
    description: 'What this tool does and when to use it',
    parameters: {
      type: 'object',
      properties: { /* ... */ },
      required: ['param1'],
    },
  },
}
```
2. Add case to `executeTool()` switch statement
3. Implement the tool function

### Adding a New Telegram Command
1. Add handler in `initializeHandlers()`:
```javascript
this.bot.command('commandname', async (ctx) => {
  await this.handleTextMessage(ctx, 'Natural language equivalent');
});
```
2. Update `/help` command text

### Database Access Pattern
```javascript
const result = await db.query(
  'SELECT * FROM table WHERE column = $1',
  [paramValue]
);
return result.rows;
```

### Zoho API Pattern
```javascript
const leads = await zohoService.searchRecords(term, 'Leads', limit);
const created = await zohoService.createLead({ Company: 'Name' });
await zohoService.updateRecord(id, 'Leads', { Lead_Status: 'Contacted' });
```

## Important Behaviors

### Conversation Context
- Last 20 messages cached in memory per user
- Context passed to OpenAI for multi-turn conversations
- Use `/clear` command to reset context
- Conversation history logged to `conversations` table

### OpenAI Function Calling
- AI decides which tools to call based on user intent
- Up to 5 tool calls per request (prevents infinite loops)
- Tool results fed back to AI for response generation
- Graceful handling when tools fail

### Email Approval Workflow
Emails require approval when:
- Deal value > £5,000/month
- Company is in `PROTECTED_ACCOUNTS` list
- Template has `autoApproval: false`

### Deal Health Categories
- **Healthy (🟢)**: < 7 days since activity
- **Attention (⚠️)**: 7-14 days
- **Urgent (🚨)**: 14-21 days
- **Critical (💀)**: > 21 days

### Quote Follow-up Sequence
Automated emails after quote sent:
1. Day 3: Soft check-in
2. Day 7: Add value with benefits
3. Day 14: Last chance with call offer
4. Day 21: Auto-close as lost

## Database Schema

7 tables created on startup:
- `conversations` - All user interactions with AI responses
- `session_state` - User session context
- `quote_sequences` - Quote follow-up tracking
- `email_approvals` - Pending email approvals
- `inbox_log` - Processed incoming emails
- `autonomous_tasks` - Scheduled task tracking
- `approval_queue` - Pending action approvals

## Deployment

### Health Check
- Endpoint: `GET /health`
- Returns database connection status
- Required by Railway, Render, etc.

### Database SSL
- Auto-detects local vs cloud environments
- Render databases (`dpg-*`) require SSL
- Local connections skip SSL

### Graceful Shutdown
- Handles `SIGINT` and `SIGTERM`
- Stops HTTP server, Telegram bot, scheduler
- Closes database connection pool

## Debugging

### Enable Debug Logging
```bash
LOG_LEVEL=debug npm start
```

### Common Issues

**Telegram Authorization:**
- Look for "Unauthorized Telegram access attempt" in logs
- Verify chat ID matches `TELEGRAM_CHAT_ID_NELSON`

**OpenAI Errors:**
- Check `OPENAI_API_KEY` is set and valid
- Model availability: verify `OPENAI_MODEL` exists

**Zoho Rate Limits:**
- App continues if rate-limited during startup
- Look for "Zoho CRM rate limited" warnings

**Voice Messages:**
- Require valid `OPENAI_API_KEY` for Whisper
- Check audio download from Telegram succeeds

## Files Not to Modify Carelessly

- `src/services/zohoService.js` - OAuth flow is sensitive
- `src/db/connection.js` - Database initialization
- `src/services/crmTools.js` - Tool definitions affect AI behavior
- `.env.example` - Template for environment variables

## Known TODOs

1. **Inbox processing** - Email monitoring not implemented (`autonomousScheduler.js`)
2. **Email sending** - Currently logs activity but doesn't send via SMTP
3. **Automated tests** - No test suite exists

## Example Interactions

The AI agent can handle requests like:
- "Find the Sudlow deal" → Searches CRM, shows results
- "Create a lead for ABC Cleaning, contact John, 07700123456" → Creates lead
- "What's our pipeline looking like?" → Shows pipeline summary with health
- "Move the Vistry deal to Negotiation" → Updates deal stage
- "Remind me to call Sarah tomorrow" → Creates task with due date
- "Show me stale deals" → Lists deals needing attention
- "What's our forecast for this month?" → Revenue projections
