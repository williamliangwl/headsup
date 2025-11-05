# Vendor Announcement Detection System

## Setup Guide

This project implements an automated vendor announcement detection system using Cloudflare Workers and Groq LLM.

## Project Status

✅ **Completed:**
- Project structure initialized
- Core Worker implementation (`src/index.ts`)
- HMAC-SHA256 signature verification
- Groq LLM integration for message classification
- Slack webhook handling and URL verification
- Test payload files created
- Error handling and logging

⏳ **Remaining Steps:**
1. Get Groq API key from https://console.groq.com
2. Update Node.js to v20+ for Wrangler CLI
3. Deploy to Cloudflare Workers
4. Configure Slack app

## Quick Start

### 1. Node.js Update (Required)
```bash
# Install Node.js v20+ using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Or download from https://nodejs.org
```

### 2. Get Groq API Key
1. Visit https://console.groq.com
2. Sign up/login
3. Create API key named "vendor-announcement-detector"
4. Copy the key (starts with `gsk_`)

### 3. Configure Environment
```bash
# Update .env file with your actual keys
GROQ_API_KEY=gsk_your_actual_key_here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_WORKSPACE_DOMAIN=yourworkspace
```

### 4. Local Development
```bash
# Install wrangler (after Node.js update)
npm install -g wrangler

# Start local development server
npm run dev
# OR
wrangler dev

# Test URL verification
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d @test/test-slack-verification.json

# Expected response: {"challenge":"3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"}
```

### 5. Deploy to Cloudflare
```bash
# Login to Cloudflare
wrangler login

# Set environment secrets
wrangler secret put GROQ_API_KEY
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put SLACK_WORKSPACE_DOMAIN

# Deploy
npm run deploy
# OR
wrangler deploy
```

## Configuration

### Channel Settings (Easy to Change)
Edit `src/index.ts` lines 8-9:
```typescript
const MONITORED_CHANNEL = 'general';  // Channel to monitor
const ALERT_CHANNEL = 'general';      // Channel for alerts
```

### Slack App Setup
1. Go to https://api.slack.com/apps
2. Create New App → From scratch
3. Name: "Vendor Announcement Monitor"
4. Basic Information → Copy Signing Secret
5. Incoming Webhooks → Toggle ON → Add New Webhook
6. Event Subscriptions → Toggle ON → Set Request URL to your Worker URL
7. Subscribe to bot events: `message.channels`
8. Install app to workspace

## Testing

### Test Files Available
- `test/test-slack-verification.json` - URL verification challenge
- `test/test-slack-payload.json` - Vendor announcement (should trigger alert)
- `test/test-slack-normal-message.json` - Normal message (should be ignored)

### Run Tests
```bash
npm test
# OR
npx ts-node test/test-runner.ts
```

## Architecture

```
Slack #general → Cloudflare Worker → Groq LLM → Alert back to #general
    ↓               ↓                    ↓              ↓
Message posted → Webhook received → Classification → Formatted alert
```

## Security Features

- ✅ HMAC-SHA256 signature verification
- ✅ Timestamp validation (5-minute window)
- ✅ Environment variable secrets
- ✅ Comprehensive error handling

## Cost

- **Cloudflare Workers**: Free tier (100k requests/day)
- **Groq API**: Free tier (generous limits)
- **Total**: $0/month for typical usage

## Support

For issues or questions:
1. Check logs: `wrangler tail`
2. Review `PROJECT_PLAN.md` for session resumption
3. Verify environment variables are set correctly

---

**Status**: Ready for deployment once Node.js is updated and API keys are configured!