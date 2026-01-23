# Render Deployment Plan (via MCP)

Once the Render MCP server is configured, here's what I'll do to deploy your app:

## Deployment Steps

### 1. Create PostgreSQL Database
- **Name:** `crmagent-db`
- **Plan:** `free` (or `basic_256mb` for production)
- **Region:** `frankfurt` (closest to EU for Zoho)
- **Version:** PostgreSQL 15

### 2. Create Web Service
- **Name:** `crmagent`
- **Repository:** Your GitHub repo (auto-connected)
- **Branch:** `main`
- **Build Command:** `npm install`
- **Start Command:** `node src/index.js`
- **Plan:** `free` (or `starter` for production)
- **Region:** `frankfurt`

### 3. Link Database to Service
- Automatically connect `crmagent-db` to `crmagent` service
- This sets `DATABASE_URL` automatically

### 4. Set Environment Variables

I'll need these from you (or from your `.env.local`):

```
TELEGRAM_BOT_TOKEN=<your_token>
TELEGRAM_CHAT_ID_NELSON=<your_chat_id>
ZOHO_CLIENT_ID=<your_client_id>
ZOHO_CLIENT_SECRET=<your_client_secret>
ZOHO_REFRESH_TOKEN=<your_refresh_token>
ZOHO_DATACENTER=eu
OPENAI_API_KEY=<your_key> (optional)
NODE_ENV=production
LOG_LEVEL=info
```

**Note:** `DATABASE_URL` will be automatically set by Render when we link the database.

### 5. Initialize Database
- Run the database initialization queries from `src/db/connection.js`
- Create all required tables

### 6. Deploy & Monitor
- Trigger deployment
- Monitor logs for errors
- Check health endpoint: `https://crmagent.onrender.com/health`

## What You Need to Provide

Before I can deploy, please provide:

1. **Render API Key** (for MCP setup)
2. **Environment Variables** (or confirm I can read from `.env.local` if it exists)
3. **GitHub Repo URL** (if not already connected)

## After Deployment

Once deployed, I can:
- ✅ View real-time logs
- ✅ Check service health
- ✅ Monitor database connections
- ✅ View metrics (CPU, memory, requests)
- ✅ Update environment variables
- ✅ Redeploy on demand

---

**Ready to deploy?** Just confirm:
1. Render MCP server is configured
2. You have your environment variables ready
3. Your GitHub repo is accessible

Then I'll handle the rest! 🚀
