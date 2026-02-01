# CLAUDE.md - AI Assistant Guide for Signature Cleans CRM Agent

This document provides essential context for AI assistants working with the Signature Cleans CRM Agent codebase.

## Project Overview

**Signature Cleans CRM Agent** is an autonomous CRM operations agent built with Node.js that:
- Integrates with Zoho CRM (EU datacenter) for lead, contact, and deal management
- Uses Telegram as the primary user interface for team communication
- Runs scheduled autonomous tasks (quote follow-ups, pipeline briefings, stale deal alerts)
- Stores operational state in PostgreSQL
- Processes natural language requests via an intent-based AI agent core

**Author:** Nelson Iseguan - Signature Cleans
**Tech Stack:** Node.js, Express, PostgreSQL, Telegraf, Zoho CRM API, OpenAI (planned for Whisper)

## Codebase Structure

```
src/
├── index.js                      # Application entry point, orchestrates startup
├── db/
│   ├── connection.js             # PostgreSQL connection pool and initialization
│   └── init.sql                  # Database schema reference (tables created programmatically)
├── handlers/
│   └── telegramHandler.js        # Telegram bot message routing and commands
├── services/
│   ├── aiAgentCore.js            # Intent detection and request processing
│   ├── zohoService.js            # Zoho CRM API integration (OAuth, CRUD operations)
│   ├── advancedCrmService.js     # Pipeline analytics, forecasting, global search
│   └── emailService.js           # Email templates, approval workflow, sending
├── tasks/
│   └── autonomousScheduler.js    # Cron-based scheduled tasks
└── utils/
    └── logger.js                 # Centralized logging utility
```

## Key Files and Their Purpose

### Entry Point
- **`src/index.js`** - Main application class `SignatureCRMAgent` that initializes all services, tests connections, starts Telegram bot, and sets up autonomous scheduler

### Database Layer
- **`src/db/connection.js`** - PostgreSQL pool with SSL handling for local/Railway/Render environments. Creates 7 tables on startup:
  - `conversations` - User interaction logs
  - `session_state` - Conversation context per user
  - `quote_sequences` - Quote follow-up email tracking
  - `email_approvals` - Pending email approvals
  - `inbox_log` - Processed incoming emails
  - `autonomous_tasks` - Scheduled task tracking
  - `approval_queue` - Pending action approvals

### Telegram Handler
- **`src/handlers/telegramHandler.js`** - Handles Telegram bot interactions
  - Authorization via chat ID whitelist (checks both chat ID and user ID)
  - Commands: `/start`, `/help`, `/pipeline`, `/metrics`, `/search`
  - Routes natural language messages to `aiAgentCore.processRequest()`
  - Voice message support is stubbed (TODO: Whisper integration)

### AI Agent Core
- **`src/services/aiAgentCore.js`** - Intent-based request processing
  - Uses regex pattern matching for intent detection (not ML-based)
  - 30+ intent handlers for leads, deals, pipeline, email, tasks, analytics, search
  - Returns structured responses with `{ success, intent, response, timestamp }`

### Zoho CRM Service
- **`src/services/zohoService.js`** - Zoho CRM API wrapper
  - OAuth 2.0 with automatic token refresh
  - Uses EU datacenter (`zohoapis.eu`)
  - Retry logic via `axios-retry`
  - CRUD operations for Leads, Contacts, Deals, Tasks, Activities
  - Search, tags, pipeline retrieval

### Advanced CRM Service
- **`src/services/advancedCrmService.js`** - Business logic layer
  - Pipeline analysis with deal health categorization (healthy/attention/urgent/critical)
  - Revenue forecasting by time period
  - Lead source attribution
  - Global search across all modules
  - Bulk update operations

### Email Service
- **`src/services/emailService.js`** - Email automation
  - Pre-built templates: `quote_followup_1/2/3`, `new_lead_welcome`, `meeting_confirm`, `meeting_reminder`
  - Variable substitution: `{first_name}`, `{company}`, `{sender_name}`, etc.
  - Approval workflow for high-value deals (>£5,000) and protected accounts

### Autonomous Scheduler
- **`src/tasks/autonomousScheduler.js`** - Cron-based automation
  - Morning pipeline briefing: 8:00 AM Mon-Fri
  - Quote follow-ups: 9:00 AM Mon-Fri (Day 3, 7, 14 emails; Day 21 auto-close)
  - Inbox processing: Every 15 minutes (TODO: needs implementation)
  - Stale deal detection: 8:00 AM daily

## Development Commands

```bash
# Install dependencies
npm install

# Run in production
npm start

# Run in development (sets NODE_ENV=development)
npm run dev

# Tests (not implemented)
npm test
```

## Environment Variables

Required variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token |
| `TELEGRAM_CHAT_ID_NELSON` | Authorized user chat ID |
| `ZOHO_CLIENT_ID` | Zoho OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth client secret |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth refresh token |
| `ZOHO_DATACENTER` | Zoho datacenter region (default: `eu`) |
| `NODE_ENV` | Environment (`development`/`production`) |
| `PORT` | HTTP server port (default: 3000) |
| `LOG_LEVEL` | Logging level (`error`/`warn`/`info`/`debug`) |

Optional variables:
- `TELEGRAM_CHAT_ID_NICK` - Additional authorized user
- `TELEGRAM_GROUP_CHAT_ID` - Group chat for notifications
- `OPENAI_API_KEY` - For future Whisper voice transcription
- `APPROVAL_REQUIRED_DEAL_VALUE` - Threshold for email approval (default: 5000)
- `PROTECTED_ACCOUNTS` - Comma-separated list of accounts requiring approval

## Code Conventions

### General Patterns
- All services are **singletons** exported as instantiated objects
- Use **async/await** throughout, no callbacks
- Structured logging with `logger.info/warn/error/debug(message, metadata)`
- Error handling: catch, log, and either rethrow or return safe defaults

### Naming Conventions
- Files: `camelCase.js`
- Classes: `PascalCase`
- Functions/methods: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database columns: `snake_case`
- Zoho API fields: `Pascal_Snake_Case` (e.g., `Deal_Name`, `Lead_Status`)

### Intent Handler Pattern
Intent handlers in `aiAgentCore.js` follow this pattern:
```javascript
async handleIntentName(message, context) {
  // 1. Extract entities from message (regex)
  // 2. Validate required data
  // 3. Call appropriate service method
  // 4. Return formatted response string
}
```

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
// Direct API call
const data = await zohoService.request('GET', '/Module/id');

// Helper methods
const leads = await zohoService.searchRecords(term, 'Leads', limit);
const created = await zohoService.createLead({ Company: 'Name' });
```

## Important Behaviors

### Authorization
- Telegram authorization checks **both** chat ID and user ID for flexibility
- All authorized IDs stored in `authorizedUsers` object in `TelegramHandler`
- Unauthorized attempts are logged with details for debugging

### Rate Limiting
- Zoho API rate limits are handled gracefully
- If rate-limited during startup, app continues with warning
- `axios-retry` provides exponential backoff for API calls

### Deal Health Categories
Deals are categorized by days since last activity:
- **Healthy (🟢)**: < 7 days
- **Attention (⚠️)**: 7-14 days
- **Urgent (🚨)**: 14-21 days
- **Critical (💀)**: > 21 days

### Quote Follow-up Sequence
Automated email sequence after quote sent:
1. Day 3: Soft check-in
2. Day 7: Add value with benefits
3. Day 14: Last chance with call offer
4. Day 21: Auto-close as lost, move to nurture

### Email Approval Workflow
Emails require approval when:
- Deal value > £5,000/month
- Company is in `PROTECTED_ACCOUNTS` list
- Template has `autoApproval: false`

## Common Tasks for AI Assistants

### Adding a New Intent
1. Add regex pattern to `detectIntent()` in `aiAgentCore.js`
2. Create handler method `handleIntentName(message, context)`
3. Register in `this.intents` object in constructor

### Adding a New Email Template
1. Add template object to `EMAIL_TEMPLATES` in `emailService.js`
2. Include `subject`, `body`, and `autoApproval` properties
3. Use `{variable}` syntax for dynamic content

### Adding a New Scheduled Task
1. Create method in `autonomousScheduler.js`
2. Call `cron.schedule()` with cron expression
3. Push task to `this.tasks` array
4. Call schedule method from `initializeTasks()`

### Adding a New Telegram Command
1. Add handler in `telegramHandler.js` using `this.bot.command('name', handler)`
2. Follow authorization pattern: check `isAuthorized(ctx.chat.id, ctx.from?.id)`
3. Update `/help` command text

### Creating a New Database Table
1. Add `CREATE TABLE IF NOT EXISTS` query in `initializeDatabase()` in `connection.js`
2. Add corresponding indexes
3. Optionally add to `init.sql` for reference

## Deployment Considerations

### Health Check
- HTTP health endpoint: `GET /health`
- Returns database connection status
- Required by platforms like Railway and Render

### Database SSL
- Auto-detects local vs cloud environments
- Render databases (`dpg-*` hostnames) require SSL with `rejectUnauthorized: false`
- Railway databases require SSL
- Local connections skip SSL

### Graceful Shutdown
- Handles `SIGINT` and `SIGTERM`
- Stops HTTP server, Telegram bot, scheduler, and closes DB pool

## Debugging Tips

### Enable Debug Logging
```bash
LOG_LEVEL=debug npm start
```

### Check Telegram Authorization Issues
Look for logs with:
- "Unauthorized Telegram access attempt"
- Check `chatId` and `userId` in log metadata

### Zoho API Issues
- Check token refresh in logs
- Verify `ZOHO_DATACENTER=eu` for EU accounts
- Rate limit errors show "too many requests" or "Access Denied"

### Database Issues
- Connection logs show URL preview (first 20 chars)
- Check `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname`

## Files Not to Modify Carelessly

- `.env.example` - Template for environment variables
- `package.json` - Dependencies and scripts
- `src/db/connection.js` - Database initialization affects all tables
- `src/services/zohoService.js` - OAuth flow is sensitive

## Known TODOs in Codebase

1. **Voice transcription** - Whisper integration not implemented (`telegramHandler.js:198`)
2. **Inbox processing** - Email monitoring not implemented (`autonomousScheduler.js:340`)
3. **Several handler stubs** - Some intent handlers return placeholder text (e.g., `handleCreateDeal`, `handleUpdateDeal`)

## Testing

No automated tests exist. Manual testing approach:
1. Send `/start` to Telegram bot
2. Test natural language: "Pipeline summary", "Find [company]"
3. Monitor logs for errors
4. Check database tables for recorded conversations
