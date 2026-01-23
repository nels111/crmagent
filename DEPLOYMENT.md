# Deployment Guide - Signature Cleans CRM Agent

Complete guide for deploying the autonomous CRM agent to Vercel with PostgreSQL database.

## 📋 Pre-Deployment Checklist

### 1. Gather Required Credentials

You'll need the following before deployment:

**Telegram:**
- [ ] Telegram Bot Token (from @BotFather)
- [ ] Nelson's Telegram Chat ID
- [ ] Nick's Telegram Chat ID
- [ ] Group Chat ID (for briefings)

**Zoho CRM:**
- [ ] Client ID (OAuth)
- [ ] Client Secret (OAuth)
- [ ] Refresh Token (OAuth)
- [ ] Datacenter: `eu` (for EU accounts)

**OpenAI:**
- [ ] API Key (for Whisper transcription)

**PostgreSQL:**
- [ ] Database URL (format: `postgresql://user:password@host:port/dbname`)

### 2. Get Telegram Chat IDs

**For personal chats:**
1. Message your bot: `/start`
2. Check logs or use: `curl https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find `chat.id` in the response

**For group chats:**
1. Add bot to group
2. Send a message
3. Check updates to get group chat ID (negative number)

### 3. Get Zoho CRM Credentials

1. Go to [Zoho CRM API Console](https://accounts.zoho.eu/developerconsole)
2. Create OAuth app:
   - Name: "Signature Cleans CRM Agent"
   - Redirect URL: `https://your-domain.vercel.app/auth/callback`
3. Get Client ID and Client Secret
4. Generate Refresh Token:
   - Use OAuth flow to get authorization code
   - Exchange for refresh token

### 4. Set Up PostgreSQL Database

**Option A: Vercel Postgres (Recommended)**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create new Postgres database
3. Copy connection string

**Option B: External PostgreSQL**
1. Use existing PostgreSQL server
2. Create database: `createdb signature_crm`
3. Get connection string

## 🚀 Deployment Steps

### Step 1: Prepare Repository

```bash
# Clone or create repository
git clone <your-repo> signature-crm-agent
cd signature-crm-agent

# Initialize git if needed
git init
git add .
git commit -m "Initial commit: Signature Cleans CRM Agent"
```

### Step 2: Deploy to Vercel

**Option A: Using Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

**Option B: Using GitHub**

1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Select your GitHub repository
5. Click "Deploy"

### Step 3: Set Environment Variables

In Vercel Dashboard:

1. Go to Project Settings → Environment Variables
2. Add each variable:

```
TELEGRAM_BOT_TOKEN = your_bot_token
TELEGRAM_CHAT_ID_NELSON = nelson_chat_id
TELEGRAM_CHAT_ID_NICK = nick_chat_id
TELEGRAM_GROUP_CHAT_ID = group_chat_id
ZOHO_CLIENT_ID = your_client_id
ZOHO_CLIENT_SECRET = your_client_secret
ZOHO_REFRESH_TOKEN = your_refresh_token
ZOHO_DATACENTER = eu
OPENAI_API_KEY = your_openai_key
DATABASE_URL = postgresql://user:password@host:port/dbname
ZOHO_EMAIL_FROM = nick@signature-cleans.co.uk
ZOHO_EMAIL_FROM_NELSON = nelson@signature-cleans.co.uk
NODE_ENV = production
LOG_LEVEL = info
```

3. Click "Save"

### Step 4: Initialize Database

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL

# Run initialization script
\i src/db/init.sql

# Verify tables created
\dt
```

Or use a database client:
1. Connect with DATABASE_URL
2. Run SQL from `src/db/init.sql`
3. Verify tables exist

### Step 5: Test Deployment

1. **Check Vercel logs:**
   ```bash
   vercel logs --prod
   ```

2. **Test Telegram bot:**
   - Send `/start` to bot
   - Should receive welcome message

3. **Test Zoho integration:**
   - Send: "Pipeline summary"
   - Should return pipeline data

4. **Check database:**
   ```bash
   psql $DATABASE_URL
   SELECT COUNT(*) FROM conversations;
   ```

## 🔧 Configuration

### Telegram Bot Setup

1. **Create bot with @BotFather:**
   - `/newbot`
   - Name: "Signature Cleans CRM Agent"
   - Username: `signature_cleans_crm_bot`
   - Get token

2. **Set webhook (optional for Vercel):**
   ```bash
   curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
     -H 'Content-Type: application/json' \
     -d '{"url":"https://your-domain.vercel.app/webhook"}'
   ```

3. **Set commands:**
   ```bash
   curl -X POST https://api.telegram.org/bot<TOKEN>/setMyCommands \
     -H 'Content-Type: application/json' \
     -d '{
       "commands": [
         {"command": "start", "description": "Initialize conversation"},
         {"command": "help", "description": "Show available commands"},
         {"command": "pipeline", "description": "Quick pipeline summary"},
         {"command": "search", "description": "Search CRM"},
         {"command": "approvals", "description": "Show pending approvals"}
       ]
     }'
   ```

### Zoho CRM Setup

1. **Enable API access:**
   - Go to Zoho CRM Settings
   - Enable API access for your user

2. **Create OAuth app:**
   - API Console → OAuth apps
   - Create new app
   - Set redirect URL to Vercel domain

3. **Get refresh token:**
   - Use OAuth flow
   - Exchange authorization code for refresh token
   - Store securely in environment variables

### PostgreSQL Setup

1. **Create database:**
   ```bash
   createdb -h localhost signature_crm
   ```

2. **Run migrations:**
   ```bash
   psql signature_crm < src/db/init.sql
   ```

3. **Verify setup:**
   ```bash
   psql signature_crm
   \dt  # List tables
   \q  # Quit
   ```

## 📊 Monitoring

### View Logs

**Vercel:**
```bash
vercel logs --prod --follow
```

**Local development:**
```bash
LOG_LEVEL=debug npm run dev
```

### Monitor Database

```bash
# Connect to database
psql $DATABASE_URL

# Check conversations
SELECT COUNT(*) FROM conversations;
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 10;

# Check quote sequences
SELECT * FROM quote_sequences WHERE sequence_cancelled = false;

# Check pending approvals
SELECT * FROM email_approvals WHERE status = 'pending';
```

### Check Telegram Bot

1. Send test message to bot
2. Check Vercel logs for processing
3. Verify response received

## 🐛 Troubleshooting

### Bot Not Responding

**Check:**
1. Telegram bot token is correct
2. Chat IDs are whitelisted
3. Vercel logs show no errors
4. Database connection works

**Fix:**
```bash
# Check logs
vercel logs --prod

# Test Telegram API
curl https://api.telegram.org/bot<TOKEN>/getMe

# Verify environment variables
vercel env list
```

### Zoho API Errors

**Check:**
1. OAuth credentials are correct
2. Refresh token is valid
3. EU datacenter URL is used
4. API scopes are enabled

**Fix:**
```bash
# Regenerate refresh token
# Go to Zoho API Console and create new OAuth app

# Test API connection
curl -X POST https://accounts.zoho.eu/oauth/v2/token \
  -d "grant_type=refresh_token&client_id=<ID>&client_secret=<SECRET>&refresh_token=<TOKEN>"
```

### Database Connection Issues

**Check:**
1. DATABASE_URL is correct format
2. PostgreSQL server is running
3. Database exists
4. User has permissions

**Fix:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check Vercel environment variables
vercel env list

# Recreate database
dropdb signature_crm
createdb signature_crm
psql signature_crm < src/db/init.sql
```

### Email Not Sending

**Check:**
1. Email templates exist
2. Zoho CRM API is working
3. Contact email is valid
4. Approval queue is empty

**Fix:**
```bash
# Check email approvals
psql $DATABASE_URL
SELECT * FROM email_approvals WHERE status = 'pending';

# Check Zoho API
curl -H "Authorization: Zoho-oauthtoken <TOKEN>" \
  https://www.zohoapis.eu/crm/v2/Leads
```

## 🔐 Security Best Practices

1. **Never commit credentials:**
   - Use `.env.local` for development
   - Use Vercel environment variables for production
   - Add `.env*` to `.gitignore`

2. **Rotate tokens regularly:**
   - Refresh Zoho refresh token quarterly
   - Rotate Telegram bot token if compromised
   - Update OpenAI API key if exposed

3. **Limit permissions:**
   - Zoho CRM: Only grant necessary scopes
   - Telegram: Whitelist authorized chat IDs
   - Database: Use read-only user for queries where possible

4. **Monitor access:**
   - Check Vercel logs regularly
   - Review database access logs
   - Monitor Telegram bot activity

## 📈 Scaling

### Increase Resources

**Vercel:**
1. Go to Project Settings
2. Increase function memory (up to 3008 MB)
3. Increase timeout (up to 900 seconds)

**PostgreSQL:**
1. Upgrade database tier
2. Add read replicas for scaling
3. Enable connection pooling

### Optimize Performance

1. **Database:**
   - Add indexes on frequently queried fields
   - Archive old conversations
   - Use connection pooling

2. **API:**
   - Cache Zoho API responses
   - Batch API requests
   - Use exponential backoff

3. **Telegram:**
   - Use webhook instead of polling
   - Batch message sending
   - Implement rate limiting

## 🚨 Disaster Recovery

### Backup Database

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Rollback Deployment

```bash
# View deployment history
vercel deployments

# Rollback to previous version
vercel rollback
```

### Restore from Backup

1. Create new database
2. Restore from backup file
3. Update DATABASE_URL
4. Redeploy

## 📞 Support

For deployment issues:

1. Check Vercel logs: `vercel logs --prod`
2. Check database: `psql $DATABASE_URL`
3. Test Telegram: Send message to bot
4. Test Zoho: Check API response
5. Review error messages in logs

## ✅ Post-Deployment Checklist

- [ ] Telegram bot responds to `/start`
- [ ] Pipeline summary works
- [ ] Search functionality works
- [ ] Database tables created
- [ ] Autonomous tasks scheduled
- [ ] Email templates loaded
- [ ] Approval workflow working
- [ ] Logs visible in Vercel
- [ ] All environment variables set
- [ ] Backup strategy in place

---

**Last Updated:** January 23, 2026
**Version:** 1.0.0
