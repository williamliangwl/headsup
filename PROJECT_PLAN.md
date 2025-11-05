# Vendor Announcement Detection System - Implementation Plan

**Project**: Slack-based vendor announcement detection using Cloudflare Workers + Groq LLM  
**Created**: 2024-11-04  
**Status**: In Progress - Phase 1

## Project Configuration

### Environment Details
- **Platform**: Cloudflare Workers (starting from scratch)
- **Slack Workspace**: New test workspace (admin access available)
- **API Key**: Groq API key needed (to be obtained)
- **Monitored Channel**: #general (configurable constant)
- **Alert Channel**: #general (same as monitored for now)

### Architecture Overview
```
Slack #general → Cloudflare Worker → Groq LLM → Alert back to #general
    ↓               ↓                    ↓              ↓
Message posted → Webhook received → Classification → Formatted alert
```

## Implementation Phases

### Phase 1: Foundation Setup ⏳
- [x] Document project plan
- [ ] Initialize project structure (package.json, tsconfig.json, wrangler.toml)
- [ ] Install dependencies (@cloudflare/workers-types, typescript)
- [ ] Get Groq API key from groq.com

### Phase 2: Core Worker Development
- [ ] Create main Worker in src/index.ts
- [ ] Implement HMAC-SHA256 signature verification
- [ ] Add URL verification challenge handler
- [ ] Integrate Groq LLM API
- [ ] Set channel constants (MONITORED_CHANNEL='general', ALERT_CHANNEL='general')

### Phase 3: Feature Implementation
- [ ] Implement Slack permalink generation
- [ ] Create formatted alert message posting
- [ ] Add comprehensive error handling and logging

### Phase 4: Testing & Deployment
- [ ] Create test JSON payloads
- [ ] Set up local development with wrangler dev
- [ ] Deploy to Cloudflare Workers with environment secrets

### Phase 5: Slack Configuration
- [ ] Create Slack app in test workspace
- [ ] Configure webhooks and event subscriptions
- [ ] Test end-to-end flow

## Key Files to Create

```
headsup/
├── src/
│   └── index.ts                      # Main Cloudflare Worker
├── test/
│   ├── test-slack-verification.json  # URL verification test
│   ├── test-slack-payload.json      # Message event test
│   └── test-runner.ts               # Local test script
├── package.json                     # Project dependencies
├── tsconfig.json                   # TypeScript configuration
├── wrangler.toml                   # Cloudflare Workers config
├── .env                           # Local environment variables
├── PROJECT_PLAN.md                # This plan document
└── README.md                      # Setup and usage instructions
```

## Environment Variables Required

| Variable | Purpose | Example | Phase |
|----------|---------|---------|-------|
| `GROQ_API_KEY` | LLM classification | `gsk_...` | 1 |
| `SLACK_WEBHOOK_URL` | Post alerts | `https://hooks.slack.com/...` | 5 |
| `SLACK_SIGNING_SECRET` | Verify requests | `a1b2c3d4...` | 5 |
| `SLACK_WORKSPACE_DOMAIN` | Generate permalinks | `yourworkspace` | 5 |

## Channel Configuration (Easily Changeable)

```typescript
// In src/index.ts - Update these constants to change behavior
const MONITORED_CHANNEL = 'general';  // Channel to monitor (without #)
const ALERT_CHANNEL = 'general';      // Channel to post alerts
```

## Next Steps

1. **Current Phase**: Phase 1 - Foundation Setup
2. **Next Task**: Initialize project structure
3. **Immediate Action**: Create package.json, tsconfig.json, wrangler.toml

## Notes

- Following tech-spec.md specifications exactly
- Modular design for easy configuration changes
- Comprehensive error handling and logging
- Security-first approach with signature verification
- Cost-effective using Groq free tier

## Session Resume Instructions

1. Check `PROJECT_PLAN.md` for current status
2. Review todo list with `todoread`
3. Continue from last incomplete phase
4. Update plan document as phases complete

---
*This document is updated as the project progresses*
