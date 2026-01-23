# Quick Setup Guide - Signature Cleans CRM Agent

Fast-track setup for getting the agent running locally or on Vercel.

## 🚀 Local Development (5 minutes)

### 1. Install Dependencies
```bash
cd signature-crm-agent
npm install
```

### 2. Create Environment File
```bash
cp .env.example .env.local
```

### 3. Add Your Credentials
Edit `.env.local` with:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID_NELSON=your_nelson_id
TELEGRAM_CHAT_ID_NICK=your_nick_id
TELEGRAM_GROUP_CHAT_ID=your_group_id
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_REFRESH_TOKEN=your_zoho_refresh_token
ZOHO_DATACENTER=eu
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql://user:password@localhost:5432/signature_crm
```

### 4. Create PostgreSQL Database
```bash
createdb -h localhost signature_crm
```

### 5. Start the Agent
```bash
npm run dev
```

You should see:
```
✅ Database initialized
✅ Telegram bot started
✅ Autonomous scheduler initialized
🎉 Signature Cleans CRM Agent is running!
```

## 🌐 Vercel Deployment (10 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy to Vercel
```bash
npm i -g vercel
vercel --prod
```

### 3. Set Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables:

Add all variables from `.env.example`

### 4. Initialize Database
```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL < src/db/init.sql
```

### 5. Test
Send `/start` to your Telegram bot - should respond!

## 📋 Getting Credentials

### Telegram Bot Token
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. `/newbot`
3. Name: "Signature Cleans CRM Agent"
4. Username: "signature_cleans_crm_bot"
5. Copy the token

### Telegram Chat IDs
```bash
# Send /start to bot, then:
curl https://api.telegram.org/bot<TOKEN>/getUpdates | jq '.result[0].message.chat.id'
```

### Zoho CRM Credentials
1. Go to [Zoho API Console](https://accounts.zoho.eu/developerconsole)
2. Create OAuth app
3. Get Client ID and Secret
4. Generate Refresh Token via OAuth flow

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com)
2. Create API key
3. Copy and save securely

### PostgreSQL Database URL
**Local:**
```
postgresql://user:password@localhost:5432/signature_crm
```

**Vercel Postgres:**
1. Create database in Vercel Dashboard
2. Copy connection string

## ✅ Verify Setup

### Test Telegram Bot
```bash
# Send message to bot
/start

# Expected response:
# 👋 Welcome to Signature Cleans CRM Agent!
# I can help you with:
# • Create leads
# • Search records
# • Update deals
# ...
```

### Test Zoho Integration
```bash
# Send to bot:
Pipeline summary

# Expected response:
# 📊 Pipeline Summary
# By Stage:
# • Qualification: X deals
# • Quote Sent: X deals
# ...
```

### Test Database
```bash
psql $DATABASE_URL
SELECT COUNT(*) FROM conversations;
\q
```

## 🎯 Next Steps

1. **Create test lead:**
   - Send: "Create lead for Test Company, John Smith, 07712345678"
   - Verify in Zoho CRM

2. **Test quote follow-up:**
   - Create deal in Zoho with stage "Quote Sent"
   - Wait for Day 3 follow-up email (or check logs)

3. **Set up group briefing:**
   - Add bot to Telegram group
   - Get group chat ID
   - Set TELEGRAM_GROUP_CHAT_ID
   - Briefing sends daily at 8 AM

4. **Configure protected accounts:**
   - Edit PROTECTED_ACCOUNTS in .env
   - These require approval before emailing

## 🐛 Troubleshooting

### Bot not responding
```bash
# Check logs
LOG_LEVEL=debug npm run dev

# Verify token
curl https://api.telegram.org/bot<TOKEN>/getMe
```

### Zoho API errors
```bash
# Test token refresh
curl -X POST https://accounts.zoho.eu/oauth/v2/token \
  -d "grant_type=refresh_token&client_id=<ID>&client_secret=<SECRET>&refresh_token=<TOKEN>"
```

### Database connection failed
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check tables
psql $DATABASE_URL -c "\dt"
```

## 📚 Documentation

- **README.md** - Full feature documentation
- **DEPLOYMENT.md** - Detailed deployment guide
- **src/index.js** - Main application entry point
- **src/services/** - Service modules (Zoho, Email)
- **src/handlers/** - Telegram bot handler
- **src/tasks/** - Autonomous scheduler

## 🎉 You're Ready!

The agent is now running and will:
- ✅ Respond to Telegram messages
- ✅ Send quote follow-ups automatically
- ✅ Send daily pipeline briefings
- ✅ Process incoming emails
- ✅ Alert about stale deals

**Questions?** Check the logs or review the documentation files.

---

**Last Updated:** January 23, 2026
**Version:** 1.0.0
