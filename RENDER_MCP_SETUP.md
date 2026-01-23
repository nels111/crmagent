# Render MCP Server Setup Guide

This guide will help you set up the Render MCP server so I can directly deploy your app to Render using MCP tools.

## Step 1: Get Your Render API Key

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your profile (top right) → **Account Settings**
3. Scroll down to **API Keys** section
4. Click **Create API Key**
5. Give it a name: `Cursor MCP Server`
6. **Copy the API key** (you'll only see it once!)

## Step 2: Configure MCP Server in Cursor

The Render MCP server needs to be configured in Cursor's settings. Here's how:

### Option A: Using Cursor Settings UI

1. Open Cursor Settings (Cmd+, on Mac, Ctrl+, on Windows)
2. Go to **Features** → **Model Context Protocol** (or search for "MCP")
3. Click **Add Server** or **Configure Servers**
4. Add the Render MCP server configuration

### Option B: Manual Configuration File

The MCP server configuration is typically in:
- **macOS/Linux:** `~/.cursor/mcp.json` or `~/.config/cursor/mcp.json`
- **Windows:** `%APPDATA%\Cursor\mcp.json`

Create or edit this file with:

```json
{
  "mcpServers": {
    "render": {
      "command": "npx",
      "args": [
        "-y",
        "@render-oss/render-mcp-server"
      ],
      "env": {
        "RENDER_API_KEY": "your_render_api_key_here"
      }
    }
  }
}
```

**Important:** Replace `your_render_api_key_here` with the API key you copied in Step 1.

## Step 3: Restart Cursor

After configuring, restart Cursor completely for the MCP server to load.

## Step 4: Verify Setup

Once configured, I'll be able to:
- ✅ List your Render services
- ✅ Create new web services
- ✅ Create PostgreSQL databases
- ✅ Set environment variables
- ✅ Deploy your app automatically
- ✅ View logs and metrics

## What I Can Do Once Setup

Once the Render MCP server is configured, I can:

1. **Create a PostgreSQL database** for your app
2. **Create a web service** connected to your GitHub repo
3. **Set all environment variables** automatically
4. **Link the database** to your service
5. **Deploy and monitor** your application

## Troubleshooting

### MCP Server Not Loading

- Make sure you've restarted Cursor completely
- Check that the API key is correct (no extra spaces)
- Verify the JSON syntax is valid

### API Key Issues

- Make sure the API key has the right permissions
- Try creating a new API key if the first one doesn't work

### Need Help?

If you're having trouble, share:
1. Your operating system
2. Where you're configuring the MCP server
3. Any error messages you see

---

**Next Steps:**
1. Get your Render API key (Step 1)
2. Configure it in Cursor (Step 2)
3. Restart Cursor (Step 3)
4. Tell me when it's done, and I'll deploy your app! 🚀
