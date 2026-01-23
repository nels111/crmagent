# Signature Cleans CRM Agent

**Autonomous CRM operations agent for Signature Cleans** - A tireless sales operations assistant that runs 24/7, handles the admin, and only escalates what needs human decision-making.

## 🎯 What This Agent Does

This is an **AUTONOMOUS** CRM agent that:

1. **Monitors the inbox** and automatically processes incoming emails
2. **Sends follow-up emails** directly from the CRM when deals go stale
3. **Updates records autonomously** based on email responses and triggers
4. **Proactively alerts** Nelson and Nick about pipeline issues
5. **Executes email sequences** without manual intervention
6. **Responds to voice/text commands** via Telegram for on-demand CRM operations

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- Telegram Bot Token
- Zoho CRM API credentials (EU datacenter)
- OpenAI API key (for voice transcription)

### Installation

1. **Clone and install dependencies:**
```bash
cd signature-crm-agent
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

3. **Initialize database:**
```bash
# Create PostgreSQL database
createdb -h localhost signature_crm

# Update DATABASE_URL in .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/signature_crm
```

4. **Start the agent:**
```bash
npm start
```

## 📋 Environment Variables

Required environment variables (see `.env.example`):

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID_NELSON=nelson_chat_id
TELEGRAM_CHAT_ID_NICK=nick_chat_id
TELEGRAM_GROUP_CHAT_ID=group_chat_id

# Zoho CRM
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=your_refresh_token
ZOHO_DATACENTER=eu

# OpenAI
OPENAI_API_KEY=your_openai_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/signature_crm

# Email
ZOHO_EMAIL_FROM=nick@signature-cleans.co.uk
ZOHO_EMAIL_FROM_NELSON=nelson@signature-cleans.co.uk

# App Config
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

## 🤖 Core Features

### 1. Telegram Bot Interface

**Commands:**
- `/start` - Initialize conversation
- `/help` - Show available commands
- `/pipeline` - Quick pipeline summary
- `/search [term]` - Search CRM
- `/approvals` - Show pending email approvals

**Natural language support:**
- "Create lead for ABC Company, John Smith, 07712345678"
- "Find Sarah at Sudlow"
- "Move Sudlow to Closed Won"
- "Remind me to call Sarah on Friday"
- "Pipeline summary"
- "Send follow-up to Sarah"

### 2. Autonomous Quote Follow-Up Sequence

Automatically sends follow-up emails on a schedule:

- **Day 3**: Soft check-in email
- **Day 7**: Add value email with benefits
- **Day 14**: Last chance email with call offer
- **Day 21**: Auto-close as lost, move to nurture sequence

**Cancellation triggers:**
- Email reply received
- Deal stage changes
- Manual stop command

### 3. Daily Pipeline Briefing

Sent to Telegram group chat at 8:00 AM (Mon-Fri):

```
📊 MORNING PIPELINE BRIEFING
Friday, 23 January 2026

ACTIVE DEALS: 12 (£34,200 total)

🟢 HEALTHY (5): £12,400
⚠️ ATTENTION (4): £9,800
🚨 URGENT (2): £8,600
💀 CRITICAL (1): £3,400
```

### 4. Inbox Monitoring

Processes incoming emails every 15 minutes:

- **NEW_LEAD**: Creates lead from enquiry
- **REPLY_POSITIVE**: Cancels sequences, updates stage
- **REPLY_NEGATIVE**: Flags for review
- **REPLY_QUESTION**: Pauses sequence, creates task
- **OUT_OF_OFFICE**: Reschedules follow-ups
- **SPAM**: Archives automatically

### 5. Email Approval Workflow

For high-stakes actions, agent drafts and waits for approval:

**Requires approval:**
- Emails to deals > £5,000/month
- Emails to key accounts (Porsche, Bouygues, Vistry, Certas)
- Bulk emails (> 5 recipients)
- Custom non-templated emails

**Approval flow:**
```
Agent → Telegram:
📧 APPROVAL NEEDED
To: Sarah (Sudlow Security)
Subject: Following up on your cleaning quote
Deal value: £2,400/month

[Email preview]

Reply: ✅ SEND / ✏️ EDIT / ❌ SKIP
```

### 6. Stale Deal Detection

Alerts team about deals with no activity:

- **7-14 days**: ⚠️ ATTENTION
- **14-21 days**: 🚨 URGENT
- **21+ days**: 💀 CRITICAL

## 📊 Database Schema

### Core Tables

- **conversations** - All user interactions (text, voice, intent)
- **session_state** - Context management per user
- **quote_sequences** - Tracks quote follow-up emails
- **email_approvals** - Pending email approvals
- **inbox_log** - Processed emails
- **autonomous_tasks** - Scheduled autonomous actions
- **approval_queue** - Pending approvals

## 🔧 Zoho CRM Integration

### Supported Modules

- **Leads** - Prospect records
- **Contacts** - Contact records
- **Deals** - Opportunities
- **Tasks** - Follow-up tasks
- **Activities** - Calls, emails, meetings

### API Features

- Search records by name, email, phone, company
- Create/update leads, contacts, deals
- Log activities and tasks
- Add/remove tags
- Get pipeline overview

### Authentication

Uses OAuth 2.0 with refresh token rotation:
- Automatic token refresh before expiry
- Exponential backoff retry logic
- EU datacenter support

## 📧 Email Templates

Pre-built templates with variable substitution:

- `quote_followup_1` - Day 3 soft check-in
- `quote_followup_2` - Day 7 add value
- `quote_followup_3` - Day 14 last chance
- `new_lead_welcome` - Acknowledge enquiry
- `meeting_confirm` - Confirm meeting
- `meeting_reminder` - Day-before reminder

**Variables:**
- `{first_name}` - Contact first name
- `{company}` - Company name
- `{deal_value}` - Deal amount
- `{sender_name}` - Sending user name
- `{sender_phone}` - Sending user phone
- `{meeting_date}` - Meeting date
- `{meeting_time}` - Meeting time

## 🔐 Security

### Authorization

- Telegram chat ID whitelist (Nelson, Nick)
- Protected accounts require approval
- High-value deals require approval
- Bulk actions require confirmation

### Data Protection

- No CRM data stored outside Zoho (except session memory)
- Conversation logs retained for debugging
- No PII shared with third parties
- Voice notes deleted after transcription

## 📈 Monitoring & Logging

### Log Levels

- `error` - Critical errors
- `warn` - Warnings
- `info` - General information
- `debug` - Detailed debugging

### Metrics Tracked

- Response latency
- API error rates
- Transcription failures
- Task completion rates
- Daily active usage

## 🚢 Deployment

### Vercel Deployment

1. **Connect repository:**
```bash
vercel link
```

2. **Set environment variables:**
```bash
vercel env add TELEGRAM_BOT_TOKEN
vercel env add ZOHO_CLIENT_ID
# ... add all required variables
```

3. **Deploy:**
```bash
vercel deploy --prod
```

### Local Development

```bash
npm run dev
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
CMD ["npm", "start"]
```

## 🧪 Testing

### Manual Testing

1. **Test Telegram bot:**
   - Send `/start` to bot
   - Try: "Create lead for Test Company"
   - Try: "Pipeline summary"

2. **Test Zoho integration:**
   - Verify API credentials
   - Check token refresh
   - Test search functionality

3. **Test autonomous tasks:**
   - Create test quote sequence
   - Wait for scheduled follow-up
   - Verify email sent

### Monitoring

Check logs:
```bash
tail -f server.log
```

Monitor database:
```bash
psql signature_crm
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 10;
```

## 🐛 Troubleshooting

### Bot not responding

1. Check Telegram bot token
2. Verify chat ID is whitelisted
3. Check logs: `LOG_LEVEL=debug npm start`

### Zoho API errors

1. Verify credentials in `.env.local`
2. Check token expiry
3. Ensure EU datacenter URL

### Database connection issues

1. Verify PostgreSQL is running
2. Check DATABASE_URL format
3. Ensure database exists

### Email not sending

1. Verify SMTP credentials
2. Check email templates exist
3. Review approval queue

## 📚 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT INTERFACE                        │
│  (Text, Voice, Commands)                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGE ROUTER                                │
│  (Intent detection, entity extraction)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI AGENT CORE                                 │
│  (Intent parser, context manager, tool router)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ ZOHO CRM API │  │ EMAIL SERVICE│  │ DATABASE     │
│              │  │              │  │              │
│ • Search     │  │ • Send       │  │ • Logs       │
│ • Create     │  │ • Approve    │  │ • State      │
│ • Update     │  │ • Template   │  │ • Sequences  │
│ • Tasks      │  │ • Track      │  │ • Approvals  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              AUTONOMOUS SCHEDULER                                │
│  (Cron tasks, quote follow-ups, briefings, inbox monitoring)    │
└─────────────────────────────────────────────────────────────────┘
```

## 📞 Support

For issues or questions:
- Check logs: `LOG_LEVEL=debug npm start`
- Review database: `psql signature_crm`
- Test Zoho API: Use Zoho API explorer
- Test Telegram: Send message to bot

## 📄 License

ISC

## 👤 Author

Nelson Iseguan - Signature Cleans

---

**Last Updated:** January 23, 2026
**Version:** 1.0.0
