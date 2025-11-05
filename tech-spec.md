# Technical Specification: Vendor Announcement Detection System

**Version:** 2.0  
**Date:** 2024-11-04  
**Author:** System Architect  
**Changes:** Added Slack signature verification, permalink support, comprehensive authentication guide

---

## 1. System Overview

### 1.1 Purpose
Automated system to detect vendor maintenance/breaking change announcements from chat platforms (Slack/Telegram) using LLM classification and post formatted alerts with permalinks back to the source channel.

### 1.2 Architecture Pattern
Serverless webhook-driven architecture with external LLM API integration and signature verification.

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│ Slack/      │─────>│ Cloudflare       │─────>│ Groq API    │
│ Telegram    │      │ Worker           │      │ (LLM)       │
│             │<─────│ (Edge Function)  │<─────│             │
└─────────────┘      └──────────────────┘      └─────────────┘
    │                        │
    │ Signature Verification │
    │ HMAC-SHA256           │
    └────────────────────────┘
```

### 1.3 Technology Stack
- **Runtime:** Cloudflare Workers (V8 isolate)
- **Language:** TypeScript
- **LLM Provider:** Groq (Llama 3.2 3B)
- **Chat Platforms:** Slack, Telegram
- **Protocol:** HTTP webhooks (REST)
- **Security:** HMAC-SHA256 signature verification

---

## 2. Component Specifications

### 2.1 Cloudflare Worker Service

#### 2.1.1 Core Responsibilities
1. Receive webhook POST requests from chat platforms
2. Verify request signatures (Slack) to prevent spoofing
3. Handle Slack URL verification challenge
4. Extract message text from platform-specific payloads
5. Call LLM API for classification
6. Construct permalinks to original messages
7. Format and send response to appropriate chat platform
8. Handle errors and logging

#### 2.1.2 API Endpoints

**Endpoint:** `POST /`  
**Description:** Single webhook endpoint for all platforms  
**Content-Type:** `application/json`

**Request Headers (Slack):**
```
X-Slack-Request-Timestamp: 1531420618
X-Slack-Signature: v0=a2114d57b48eac39b9ad189dd8316235a7b4a8d21a10bd27519666489c69b503
Content-Type: application/json
```

**Request Body Examples:**

Slack (URL Verification):
```json
{
  "type": "url_verification",
  "challenge": "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P",
  "token": "Jhj5dZrVaK7ZwHHjRyZWjbDl"
}
```

Slack (Message Event):
```json
{
  "type": "event_callback",
  "event": {
    "type": "message",
    "text": "AWS RDS maintenance scheduled...",
    "channel": "C1234567890",
    "user": "U1234567890",
    "ts": "1234567890.123456"
  },
  "team_id": "T01234567"
}
```

Telegram:
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1234,
    "from": {
      "id": 123456789,
      "first_name": "John"
    },
    "chat": {
      "id": -1001234567890,
      "type": "channel"
    },
    "text": "Stripe API deprecation notice..."
  }
}
```

**Response Examples:**

URL Verification:
```json
{
  "challenge": "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"
}
```

Detection Result:
```json
{
  "detected": true,
  "summary": "AWS RDS maintenance in us-east-1 on Nov 15",
  "permalink": "https://mycompany.slack.com/archives/C1234567890/p1234567890123456"
}
```

#### 2.1.3 Environment Variables

| Variable | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `GROQ_API_KEY` | string | Yes | Groq API authentication key | `gsk_...` |
| `SLACK_WEBHOOK_URL` | string | No* | Slack incoming webhook URL | `https://hooks.slack.com/services/...` |
| `SLACK_SIGNING_SECRET` | string | No** | Slack signature verification secret | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |
| `SLACK_WORKSPACE_DOMAIN` | string | No*** | Workspace domain for permalinks | `mycompany` |
| `TELEGRAM_BOT_TOKEN` | string | No* | Telegram bot token | `123456789:ABCdef...` |
| `TELEGRAM_CHAT_ID` | string | No* | Telegram chat/channel ID | `-1001234567890` |

*At least one platform must be configured  
**Recommended for security but technically optional  
***Optional but recommended for permalink support

#### 2.1.4 Request Flow

```
1. Request arrives → POST /
         ↓
2. Check if URL verification → Respond with challenge
         ↓
3. Verify signature (Slack only) → Reject if invalid (401)
         ↓
4. Detect source platform → Extract message text
         ↓
5. Call LLM API → Classify message
         ↓
6. If announcement detected → Construct permalink
         ↓
7. Format alert message → Post to chat platform
         ↓
8. Return response → Log results
```

#### 2.1.5 Error Handling

| Error Type | HTTP Status | Response | Action |
|------------|-------------|----------|--------|
| Invalid method | 405 | "Method not allowed" | Reject non-POST |
| Invalid signature | 401 | "Unauthorized" | Reject spoofed request |
| Missing message | 400 | "No message text found" | Return error |
| LLM API failure | 500 | "Error: {details}" | Log and return |
| Webhook posting failure | 500 | "Error: {details}" | Log but continue |

---

## 3. Authentication & Security

### 3.1 Slack Authentication Flow

#### 3.1.1 What You Need (No OAuth Required!)

| Component | Purpose | Where to Get | OAuth Required? |
|-----------|---------|--------------|-----------------|
| **Signing Secret** | Verify requests from Slack | Basic Information | ❌ No |
| **Incoming Webhook URL** | Post messages to Slack | Incoming Webhooks | ❌ No |
| **Bot Token** | ❌ Not needed for this use case | OAuth & Permissions | N/A |

#### 3.1.2 Signature Verification Algorithm

**Purpose:** Prevent unauthorized requests to your Worker

**Algorithm:** HMAC-SHA256

**Process:**
```typescript
1. Extract headers:
   - timestamp = X-Slack-Request-Timestamp
   - signature = X-Slack-Signature

2. Check timestamp freshness (prevent replay attacks):
   - if (currentTime - timestamp) > 300 seconds → reject

3. Construct signature base string:
   - baseString = `v0:${timestamp}:${requestBody}`

4. Calculate expected signature:
   - expectedSig = HMAC-SHA256(signingSecret, baseString)
   - prefix with "v0="

5. Compare signatures:
   - if (expectedSig === signature) → valid
   - else → reject (401)
```

**Implementation:**
```typescript
async function verifySlackSignature(
  request: Request,
  body: string,
  signingSecret: string
): Promise<boolean> {
  const timestamp = request.headers.get('X-Slack-Request-Timestamp');
  const slackSignature = request.headers.get('X-Slack-Signature');

  if (!timestamp || !slackSignature) return false;

  // Prevent replay attacks
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    return false;
  }

  // Create signature base string
  const signatureBaseString = `v0:${timestamp}:${body}`;

  // Calculate HMAC SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signatureBaseString)
  );

  // Convert to hex
  const expectedSignature = 'v0=' + Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return expectedSignature === slackSignature;
}
```

#### 3.1.3 URL Verification Challenge

**When:** First time you configure Event Subscriptions URL

**Flow:**
```
1. You enter Worker URL in Slack App settings
         ↓
2. Slack sends POST request:
   {
     "type": "url_verification",
     "challenge": "random_string"
   }
         ↓
3. Worker must respond immediately:
   {
     "challenge": "same_random_string"
   }
         ↓
4. Slack verifies match → Shows green checkmark ✓
```

**Implementation:**
```typescript
if (body.type === 'url_verification') {
  return new Response(
    JSON.stringify({ challenge: body.challenge }), 
    { headers: { 'Content-Type': 'application/json' } }
  );
}
```

### 3.2 Telegram Authentication

**Webhook Setup:**
- Simple webhook URL configuration
- No signature verification in basic setup
- Optional: Implement secret token validation

**Security Note:** Telegram doesn't provide built-in signature verification like Slack. For production, consider:
- Using a secret path in your Worker URL
- Implementing custom token validation

---

## 4. LLM Integration Specification

### 4.1 Provider: Groq API

**Base URL:** `https://api.groq.com/openai/v1/chat/completions`  
**Authentication:** Bearer token in Authorization header  
**Model:** `llama-3.2-3b-preview`  
**Free Tier:** Available, generous limits for this use case

### 4.2 Request Specification

```json
{
  "model": "llama-3.2-3b-preview",
  "messages": [
    {
      "role": "system",
      "content": "You are a specialized assistant that detects vendor maintenance announcements, breaking changes, and service disruptions. Respond only in valid JSON format."
    },
    {
      "role": "user",
      "content": "Analyze this message and determine if it's a vendor maintenance or breaking change announcement.\n\nMessage: \"{MESSAGE_TEXT}\"\n\nRespond in JSON format with:\n{\n  \"isVendorAnnouncement\": boolean,\n  \"summary\": \"brief summary if true, empty if false\",\n  \"vendor\": \"vendor name if identifiable\",\n  \"type\": \"maintenance\" or \"breaking_change\" or \"outage\" if applicable,\n  \"impact\": \"high/medium/low\" if applicable\n}"
    }
  ],
  "temperature": 0.1,
  "max_tokens": 200
}
```

### 4.3 Response Specification

**Success Response (200):**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "{\"isVendorAnnouncement\": true, \"summary\": \"AWS RDS maintenance in us-east-1\", \"vendor\": \"AWS\", \"type\": \"maintenance\", \"impact\": \"medium\"}"
      }
    }
  ]
}
```

### 4.4 Classification Schema

**Output JSON Schema:**
```typescript
interface AnnouncementClassification {
  isVendorAnnouncement: boolean;
  summary: string;                    // Empty if false
  vendor?: string;                    // e.g., "AWS", "Stripe", "MongoDB"
  type?: "maintenance" | "breaking_change" | "outage";
  impact?: "high" | "medium" | "low";
}
```

**Classification Criteria:**
- `isVendorAnnouncement: true` if message contains:
  - Scheduled maintenance windows
  - API deprecation notices
  - Breaking changes announcements
  - Service disruption alerts
  - Version upgrade requirements
  
- `type` determination:
  - `maintenance`: Planned downtime/updates
  - `breaking_change`: API changes requiring code updates
  - `outage`: Unplanned service disruption

- `impact` determination:
  - `high`: Service unavailable, immediate action required
  - `medium`: Functionality affected, action required soon
  - `low`: Minor changes, informational

---

## 5. Permalink Generation

### 5.1 Overview

Permalinks allow users to jump directly to the original announcement message.

### 5.2 Slack Permalink Construction

#### Method: Manual Construction (No OAuth Required)

**Formula:**
```
https://{workspace}.slack.com/archives/{channel}/p{message_id}

Where:
- workspace: Your Slack workspace domain
- channel: Channel ID from event (e.g., C1234567890)
- message_id: Timestamp with dot removed (e.g., 1234567890123456)
```

**Implementation:**
```typescript
function constructSlackPermalink(
  body: any, 
  workspaceDomain?: string
): string | null {
  if (!workspaceDomain) return null;
  
  const channel = body.event?.channel;
  const ts = body.event?.ts;
  
  if (!channel || !ts) return null;
  
  // Convert: "1234567890.123456" → "1234567890123456"
  const messageId = ts.replace('.', '');
  
  return `https://${workspaceDomain}.slack.com/archives/${channel}/p${messageId}`;
}
```

**Example:**
```
Input:
- workspaceDomain: "techcorp"
- channel: "C05ABC123XY"
- ts: "1730745600.123456"

Output:
https://techcorp.slack.com/archives/C05ABC123XY/p1730745600123456
```

#### Alternative: API Method (Requires OAuth)

**Not recommended for this use case.** If needed:

1. Add Bot Token to environment
2. Add `links:read` scope
3. Call `chat.getPermalink` API
4. Adds 100-300ms latency

**Why manual is better:**
- ✅ No OAuth complexity
- ✅ No API call latency
- ✅ No rate limits
- ✅ Format is stable (unchanged for years)

### 5.3 Getting Workspace Domain

**Option 1: From Browser**
```
1. Open Slack in browser
2. Look at URL: https://YOURWORKSPACE.slack.com/...
3. Extract: YOURWORKSPACE
```

**Option 2: Ask workspace admin**

**Configure:**
```bash
wrangler secret put SLACK_WORKSPACE_DOMAIN
# Enter: yourworkspace (without .slack.com)
```

---

## 6. Chat Platform Integration

### 6.1 Slack Integration

#### 6.1.1 Setup Process

**Step 1: Create Slack App**
1. Go to https://api.slack.com/apps
2. Create New App → From scratch
3. Name: "Vendor Announcement Monitor"
4. Select workspace

**Step 2: Get Signing Secret**
1. Basic Information → App Credentials
2. Copy Signing Secret
3. Save for Worker environment variables

**Step 3: Enable Incoming Webhooks**
1. Incoming Webhooks → Toggle ON
2. Add New Webhook to Workspace
3. Select announcement channel
4. Copy webhook URL

**Step 4: Enable Event Subscriptions**
1. Event Subscriptions → Toggle ON
2. Request URL: `https://your-worker.workers.dev`
3. Slack will verify (Worker handles automatically)
4. Subscribe to bot events:
   - `message.channels`
   - `message.groups` (optional, for private channels)
5. Save Changes

**Step 5: Install App**
1. Install App → Install to Workspace
2. Authorize

**Step 6: Add Bot to Channel**
1. Go to announcement channel
2. Type: `/invite @Vendor Announcement Monitor`
3. Or: Channel Settings → Integrations → Add apps

#### 6.1.2 Incoming Webhooks (Receive)
- **Setup:** Event Subscriptions
- **Events:** `message.channels`, `message.groups`
- **Verification:** URL verification challenge
- **Security:** Signature verification
- **Rate Limits:** 1 request per second per workspace

#### 6.1.3 Outgoing Webhooks (Send)
**Endpoint:** Configured webhook URL  
**Method:** POST  
**Payload:**
```json
{
  "text": "🚨 **VENDOR ANNOUNCEMENT DETECTED**\n\n**Type:** maintenance\n**Vendor:** AWS\n**Impact:** medium\n\n**Summary:**\nAWS RDS maintenance in us-east-1\n\n**Original Message:** https://techcorp.slack.com/archives/C05/p1730745600123456\n\n---\n_Detected by automated monitoring_"
}
```

### 6.2 Telegram Integration

#### 6.2.1 Setup Process

**Step 1: Create Bot**
1. Open Telegram, search for @BotFather
2. Send: `/newbot`
3. Follow instructions
4. Copy bot token

**Step 2: Get Chat ID**
1. Add bot to channel/group
2. Send test message
3. Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find: `"chat":{"id":-1234567890}`
5. Copy chat ID

**Step 3: Set Webhook**
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-worker.workers.dev",
    "drop_pending_updates": true
  }'
```

**Step 4: Verify Webhook**
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

#### 6.2.2 Incoming Webhooks (Receive)
- **Setup:** Bot created via @BotFather
- **Webhook:** Set via `setWebhook` API
- **Rate Limits:** 30 requests per second

#### 6.2.3 Outgoing Messages (Send)
**Endpoint:** `https://api.telegram.org/bot{BOT_TOKEN}/sendMessage`  
**Method:** POST  
**Payload:**
```json
{
  "chat_id": "-1001234567890",
  "text": "🚨 **VENDOR ANNOUNCEMENT DETECTED**\n\n**Type:** maintenance\n**Vendor:** AWS\n**Impact:** medium\n\n**Summary:**\nAWS RDS maintenance in us-east-1\n\n---\n_Detected by automated monitoring_",
  "parse_mode": "Markdown"
}
```

---

## 7. Local Development Setup

### 7.1 Prerequisites
```bash
# Required tools
- Node.js v18+
- npm or yarn
- wrangler CLI (Cloudflare Workers CLI)
```

### 7.2 Project Structure
```
vendor-announcement-detector/
├── src/
│   └── index.ts                      # Main worker code
├── test/
│   ├── test-slack-payload.json       # Slack test data
│   ├── test-slack-verification.json  # URL verification test
│   ├── test-telegram-payload.json    # Telegram test data
│   └── test-runner.ts                # Local test script
├── wrangler.toml                     # Cloudflare config
├── package.json
├── tsconfig.json
├── .env                              # Local env vars (gitignored)
└── README.md
```

### 7.3 Installation Steps

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Create project
mkdir vendor-announcement-detector
cd vendor-announcement-detector

# 3. Initialize project
npm init -y
npm install --save-dev @cloudflare/workers-types typescript

# 4. Create wrangler.toml
cat > wrangler.toml << 'EOF'
name = "vendor-announcement-detector"
main = "src/index.ts"
compatibility_date = "2024-11-04"

[vars]
# Non-sensitive variables go here

# Secrets (use: wrangler secret put KEY)
# GROQ_API_KEY
# SLACK_WEBHOOK_URL
# SLACK_SIGNING_SECRET
# SLACK_WORKSPACE_DOMAIN
# TELEGRAM_BOT_TOKEN
# TELEGRAM_CHAT_ID
EOF

# 5. Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ES2022",
    "lib": ["ES2021"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"]
}
EOF

# 6. Create .env for local testing
cat > .env << 'EOF'
GROQ_API_KEY=your_groq_api_key_here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_WORKSPACE_DOMAIN=yourworkspace
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
EOF

# 7. Create source directory
mkdir -p src test

# 8. Copy Worker code to src/index.ts
# (Use the code from the artifact)
```

### 7.4 Local Testing

#### 7.4.1 Test Payloads

Create `test/test-slack-verification.json`:
```json
{
  "type": "url_verification",
  "challenge": "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P",
  "token": "Jhj5dZrVaK7ZwHHjRyZWjbDl"
}
```

Create `test/test-slack-payload.json`:
```json
{
  "type": "event_callback",
  "event": {
    "type": "message",
    "text": "🚨 SCHEDULED MAINTENANCE: AWS RDS will undergo maintenance in us-east-1 region on November 15, 2024, from 02:00 to 04:00 UTC. Expected downtime: 5-10 minutes. Please plan accordingly.",
    "channel": "C1234567890",
    "user": "U1234567890",
    "ts": "1699123456.789012"
  },
  "team_id": "T01234567"
}
```

Create `test/test-telegram-payload.json`:
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1234,
    "from": {
      "id": 123456789,
      "first_name": "Test"
    },
    "chat": {
      "id": -1001234567890,
      "type": "channel",
      "title": "Announcements"
    },
    "text": "⚠️ BREAKING CHANGE: Stripe API version v2023-10-16 will be deprecated on December 1, 2024. All applications must migrate to v2024-06-20 or later. Migration guide: https://stripe.com/docs/upgrades"
  }
}
```

#### 7.4.2 Test Script

Create `test/test-runner.ts`:
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

require('dotenv').config();

// Generate Slack signature for testing
function generateSlackSignature(body: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sigBaseString = `v0:${timestamp}:${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(sigBaseString)
    .digest('hex');
  return `v0=${signature}`;
}

async function testWorker(payloadFile: string) {
  const payload = JSON.parse(
    fs.readFileSync(path.join(__dirname, payloadFile), 'utf-8')
  );

  console.log(`\n=== Testing with ${payloadFile} ===\n`);
  
  const bodyString = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Generate signature for Slack tests
  const signature = payloadFile.includes('slack') && process.env.SLACK_SIGNING_SECRET
    ? generateSlackSignature(bodyString, process.env.SLACK_SIGNING_SECRET)
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (signature) {
    headers['X-Slack-Request-Timestamp'] = timestamp;
    headers['X-Slack-Signature'] = signature;
  }

  // Simulate fetch to local worker
  console.log('Request Headers:', headers);
  console.log('Request Body:', bodyString);
  
  // In real test, you'd call your Worker
  // For local testing, use: wrangler dev
}

async function runTests() {
  console.log('Starting tests...\n');
  
  await testWorker('test-slack-verification.json');
  await testWorker('test-slack-payload.json');
  await testWorker('test-telegram-payload.json');
  
  console.log('\n✅ All tests completed');
  console.log('\nTo test with real Worker:');
  console.log('1. Run: wrangler dev');
  console.log('2. Use curl to POST test payloads to http://localhost:8787');
}

runTests().catch(console.error);
```

#### 7.4.3 Run Local Development Server

```bash
# Install dependencies for testing
npm install --save-dev dotenv @types/node

# Start local dev server
wrangler dev

# In another terminal, test URL verification
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d @test/test-slack-verification.json

# Expected response:
# {"challenge":"3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"}

# Test message detection
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d @test/test-slack-payload.json

# Or run test script
npx ts-node test/test-runner.ts
```

### 7.5 Debugging

#### Enable verbose logging:
```typescript
// Add to worker code (already included)
console.log('Received payload:', JSON.stringify(body, null, 2));
console.log('Signature valid:', isValid);
console.log('Extracted message:', messageText);
console.log('LLM response:', JSON.stringify(isAnnouncement, null, 2));
console.log('Permalink:', permalink);
```

#### View logs:
```bash
# Local development
wrangler dev --local --log-level debug

# Production (real-time)
wrangler tail

# Production (pretty format)
wrangler tail --format pretty
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Test Cases:**

1. **URL Verification Challenge**
   - Input: `{type: "url_verification", challenge: "abc123"}` 
   - Output: `{challenge: "abc123"}`
   - Status: 200

2. **Signature Verification**
   - Valid signature → Process request
   - Invalid signature → 401 Unauthorized
   - Expired timestamp (>5 min) → 401 Unauthorized
   - Missing headers → 401 Unauthorized

3. **Platform Detection**
   - Input: Slack payload → Output: 'slack'
   - Input: Telegram payload → Output: 'telegram'

4. **Message Extraction**
   - Input: Slack event → Output: text field
   - Input: Telegram message → Output: text/caption field

5. **Permalink Construction**
   - Input: Workspace "techcorp", Channel "C123", TS "1234567890.123456"
   - Output: `https://techcorp.slack.com/archives/C123/p1234567890123456`
   - Input: No workspace → Output: null

6. **Classification Accuracy**
   - True Positives: Maintenance announcements detected
   - True Negatives: Regular messages ignored
   - False Positive Rate: < 5%
   - False Negative Rate: < 2%

### 8.2 Integration Tests

**Test Scenarios:**

1. **End-to-End Slack Flow**
   ```bash
   POST /webhook with valid Slack signature
   → Verify signature check passes
   → Verify LLM called
   → Verify permalink constructed
   → Verify Slack webhook posted
   → Verify correct formatting
   ```

2. **End-to-End Telegram Flow**
   ```bash
   POST /webhook with Telegram payload
   → Verify LLM called
   → Verify Telegram API called
   → Verify correct formatting
   ```

3. **Security Tests**
   - Invalid signature → 401 rejection
   - Replay attack (old timestamp) → 401 rejection
   - Missing signature headers → 401 rejection

4. **Error Scenarios**
   - Invalid API key → 500 error
   - Malformed payload → 400 error
   - LLM timeout → Graceful degradation
   - Webhook post failure → Log but don't crash

### 8.3 Test Messages

**Positive Cases (Should Detect):**
```
1. "AWS RDS maintenance scheduled for Nov 15, 2024, 02:00-04:00 UTC"
2. "BREAKING: Stripe API v2023 deprecated Dec 1, 2024"
3. "MongoDB Atlas experiencing connectivity issues in us-east-1"
4. "Scheduled maintenance: Elasticsearch upgrade tonight 10PM-12AM"
5. "⚠️ GitHub Actions will require Node.js 18+ starting Jan 2025"
6. "🚨 Urgent: Heroku Postgres experiencing elevated error rates"
7. "Service disruption: Twilio SMS delayed 15-30 minutes"
8. "NOTICE: Redis v6 end-of-life March 2