# AI Agent Guide for Vendor Announcement Detection System

This document provides guidance for AI agents working with the Vendor Announcement Detection System, including setup, troubleshooting, testing, and maintenance procedures.

## 🤖 Agent Overview

The Vendor Announcement Detection System is a **Cloudflare Worker** that monitors Slack channels for vendor maintenance announcements using **LLM classification** and posts threaded alerts with user mentions.

### Key Components
- **Main Worker**: `src/index.ts` - Core Slack event processing and LLM integration
- **Configuration**: `wrangler.toml` - Multi-environment deployment settings
- **Security**: HMAC signature verification and bot loop prevention
- **Testing**: Comprehensive test suite in `test/` directory

## 🚀 Quick Start for Agents

### 1. Environment Setup
```bash
# Ensure Node.js v20+
nvm use 20

# Install dependencies
npm install

# Build and test
npm run build
```

### 2. Configuration Check
Verify these files exist and are properly configured:
- `wrangler.toml` - Environment variables and deployment settings
- `.env` - Local development secrets (excluded from git)
- `src/index.ts` - Main Worker logic

### 3. Required Secrets
Ensure these secrets are configured (use `wrangler secret put <KEY>`):
- `GROQ_API_KEY` - Groq LLM API key
- `SLACK_BOT_TOKEN` - Slack bot token (starts with `xoxb-`)
- `SLACK_SIGNING_SECRET` - Slack app signing secret

## 📋 Common Agent Tasks

### Task 1: Deploy System
```bash
# Production deployment
wrangler deploy --env=""

# Development deployment
wrangler deploy --env dev

# Staging deployment
wrangler deploy --env staging
```

### Task 2: Test System
```bash
# Test locally
./test-local.sh

# Test production deployment
./test-live.sh

# Run specific test
node test/test-runner.ts
```

### Task 3: Monitor & Debug
```bash
# View live logs
wrangler tail

# Check deployment status
wrangler whoami && wrangler deployments list
```

### Task 4: Update Configuration
Environment variables can be updated in `wrangler.toml`:
```toml
[vars]
MONITORED_CHANNELS = "new-channel,alerts"
SLACK_WORKSPACE_DOMAIN = "your-workspace"
```

## 🔧 Troubleshooting Guide

### Issue: TypeScript Compilation Errors
**Symptoms**: `npm run build` fails with TypeScript errors
**Solution**:
1. Check for duplicate function definitions
2. Verify all imports are properly typed
3. Look for orphaned code blocks from debugging

```bash
# Check compilation
npm run build

# Fix common issues
# - Remove duplicate functions
# - Check function signatures match interfaces
# - Verify all variables are properly typed
```

### Issue: Deployment Failures
**Symptoms**: `wrangler deploy` fails or returns errors
**Common Causes**:
1. **Node version**: Requires Node.js v20+
2. **Missing secrets**: Required secrets not configured
3. **Syntax errors**: TypeScript compilation issues

```bash
# Fix Node version
nvm use 20

# Check secrets
wrangler secret list

# Verify compilation
npm run build
```

### Issue: Slack Events Not Processing
**Symptoms**: Worker receives events but doesn't respond
**Debug Steps**:
1. Check Slack signature verification
2. Verify channel filtering logic
3. Check bot detection (infinite loop prevention)
4. Verify LLM API connectivity

```bash
# View live logs
wrangler tail

# Test with specific payload
curl -X POST "https://your-worker.workers.dev" \
  -H "Content-Type: application/json" \
  -d @test/test-slack-payload.json
```

### Issue: LLM Classification Errors
**Symptoms**: Messages not being classified correctly
**Debug Steps**:
1. Check Groq API key validity
2. Review LLM prompt in `classifyMessage()` function
3. Test with known vendor announcements
4. Check API response format

## 🧪 Testing Procedures

### Automated Testing
```bash
# Run all tests
./test-local.sh

# Test specific scenarios
node test/test-runner.ts
```

### Manual Testing in Slack
Post these messages in your monitored channel:

**AWS Maintenance:**
```
🚨 SCHEDULED MAINTENANCE: AWS RDS will undergo maintenance in us-east-1 region on December 20, 2024, from 02:00 to 04:00 UTC. Expected downtime: 5-10 minutes.
```

**Breaking Change:**
```
🔥 BREAKING: Stripe API v2024-04-10 will be deprecated on January 31, 2025. All integrations must migrate to v2024-10-28.
```

**Expected Behavior:**
- System should detect vendor announcements
- Post threaded replies with @williamliang82 mentions
- Include vendor, type, and impact analysis

### Load Testing
```bash
# Stress test with multiple payloads
for i in {1..10}; do
  curl -X POST "https://your-worker.workers.dev" \
    -H "Content-Type: application/json" \
    -d @test/test-slack-payload.json &
done
```

## 🔄 Maintenance Tasks

### Regular Updates
1. **Dependencies**: `npm audit && npm update`
2. **Secrets rotation**: Update API keys periodically
3. **Log monitoring**: Check `wrangler tail` for errors
4. **Test validation**: Run test suite before major changes

### Performance Monitoring
- Monitor LLM API response times
- Check Slack API rate limits
- Review Cloudflare Worker metrics

### Security Checks
- Verify HMAC signature validation is working
- Ensure bot detection prevents infinite loops
- Check that sensitive data isn't logged

## 📁 File Structure Reference

```
headsup/
├── src/
│   └── index.ts              # Main Worker logic
├── test/                     # Test scenarios
│   ├── test-runner.ts        # Test execution
│   └── *.json               # Test payloads
├── wrangler.toml            # Cloudflare configuration
├── package.json             # Dependencies
├── tsconfig.json           # TypeScript config
├── test-local.sh           # Local testing script
├── test-live.sh            # Production testing script
└── .env                    # Local secrets (gitignored)
```

## 🔗 Key Functions Reference

### Core Functions in `src/index.ts`:
- `processSlackMessage()` - Main event handler
- `classifyMessage()` - LLM integration for announcement detection
- `shouldMonitorChannel()` - Channel filtering logic
- `isBotMessage()` - Bot detection for loop prevention
- `postSlackAlert()` - Thread reply posting
- `verifySlackSignature()` - Security validation

### Configuration:
- Environment variables in `wrangler.toml`
- Secrets managed via `wrangler secret put`
- Multi-environment support (dev/staging/prod)

## 🚨 Critical Safeguards

### Bot Loop Prevention
The system has multiple layers to prevent infinite loops:
1. `bot_id` detection
2. `bot_profile` checking  
3. Content signature detection
4. `subtype` validation

### Security Measures
- HMAC signature verification
- Request timestamp validation
- Proper error handling and logging

### Data Protection
- No sensitive data in logs
- Secrets properly separated from code
- Environment-specific configurations

## 📞 Emergency Procedures

### System Down
1. Check Cloudflare Workers status
2. Verify secrets are still valid
3. Check Slack app configuration
4. Review recent deployments

### Infinite Loop Detected
1. Immediately check `wrangler tail` logs
2. Look for repeated bot messages
3. Verify `isBotMessage()` function is working
4. Deploy hotfix if needed

### False Positive Alerts
1. Review LLM classification logic
2. Check recent message patterns
3. Adjust prompt in `classifyMessage()` if needed
4. Test with problematic messages

---

## 📝 Notes for AI Agents

- **Always test locally** before deploying to production
- **Use environment-specific deployments** to avoid affecting production
- **Monitor logs actively** during testing and deployment
- **Preserve environment variables** - they're configured for specific channels
- **Follow the security model** - never bypass signature verification
- **Respect rate limits** - both Slack and Groq APIs have limits

This system is **production-ready** and actively monitoring Slack channels. Handle with care and always test changes thoroughly.