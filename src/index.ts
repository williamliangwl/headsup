/**
 * Vendor Announcement Detection System
 * Cloudflare Worker for detecting vendor maintenance/breaking change announcements
 * from Slack using LLM classification
 */

// Environment interface
interface Env {
  GROQ_API_KEY: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_WORKSPACE_DOMAIN?: string;
  MONITORED_CHANNELS?: string;  // Comma-separated list of channel names to monitor (without #)
}

// Slack event interfaces
interface SlackEvent {
  type: string;
  text?: string;
  channel?: string;
  user?: string;
  ts?: string;
  username?: string;   // Bot display name
  bot_id?: string;     // Bot identifier
  subtype?: string;    // Message subtype (e.g., "bot_message")
  bot_profile?: {      // Bot profile information
    id: string;
    name: string;
    app_id: string;
  };
}

interface SlackPayload {
  type: string;
  challenge?: string;
  event?: SlackEvent;
  team_id?: string;
}

// LLM response interface
interface AnnouncementClassification {
  isVendorAnnouncement: boolean;
  summary: string;
  vendor?: string;
  type?: 'maintenance' | 'breaking_change' | 'outage';
  impact?: 'high' | 'medium' | 'low';
}

/**
 * HMAC-SHA256 Slack signature verification
 * Prevents unauthorized requests to the Worker
 */
async function verifySlackSignature(
  request: Request,
  body: string,
  signingSecret: string
): Promise<boolean> {
  const timestamp = request.headers.get('X-Slack-Request-Timestamp');
  const slackSignature = request.headers.get('X-Slack-Signature');

  if (!timestamp || !slackSignature) {
    console.log('Missing signature headers');
    return false;
  }

  // Prevent replay attacks (5 minute window)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    console.log('Request timestamp too old');
    return false;
  }

  try {
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
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Check if a channel should be monitored based on environment configuration
 */
async function shouldMonitorChannel(channelId: string, env: Env): Promise<boolean> {
  // If no channels configured, don't monitor any (safer default)
  if (!env.MONITORED_CHANNELS) {
    console.log('⚠️ No MONITORED_CHANNELS configured - skipping all channels');
    return false;
  }

  // Parse comma-separated channel names and trim whitespace
  const monitoredChannelNames = env.MONITORED_CHANNELS
    .split(',')
    .map(name => name.trim().toLowerCase()) // Convert to lowercase for comparison
    .filter(name => name.length > 0);

  if (monitoredChannelNames.length === 0) {
    console.log('⚠️ MONITORED_CHANNELS is empty - skipping all channels');
    return false;
  }

  // Get the actual channel name from Slack API
  const channelName = await getChannelName(channelId, env);
  
  if (!channelName) {
    console.log(`❌ Could not resolve channel name for ID: ${channelId} - skipping`);
    return false;
  }

  const isMonitored = monitoredChannelNames.includes(channelName.toLowerCase());
  
  if (isMonitored) {
    console.log(`✅ Channel #${channelName} (${channelId}) is in monitored list: [${monitoredChannelNames.join(', ')}]`);
  } else {
    console.log(`❌ Channel #${channelName} (${channelId}) not in monitored list: [${monitoredChannelNames.join(', ')}] - skipping`);
  }

  return isMonitored;
}

/**
 * Detect if a message is from a bot to prevent infinite loops
 */
function constructSlackPermalink(
  body: SlackPayload,
  workspaceDomain?: string
): string | null {
  if (!workspaceDomain) {
    console.log('No workspace domain configured, skipping permalink');
    return null;
  }
  
  const channel = body.event?.channel;
  const ts = body.event?.ts;
  
  if (!channel || !ts) {
    console.log('Missing channel or timestamp for permalink');
    return null;
  }
  
  // Convert: "1234567890.123456" → "1234567890123456"
  const messageId = ts.replace('.', '');
  
  return `https://${workspaceDomain}.slack.com/archives/${channel}/p${messageId}`;
}

/**
 * Call Groq LLM API for vendor announcement classification
 */
async function classifyMessage(messageText: string, env: Env): Promise<AnnouncementClassification> {
  const prompt = `Analyze this message and determine if it's a vendor maintenance or breaking change announcement.

Message: "${messageText}"

Respond in JSON format with:
{
  "isVendorAnnouncement": boolean,
  "summary": "brief summary if true, empty if false",
  "vendor": "vendor name if identifiable",
  "type": "maintenance" or "breaking_change" or "outage" if applicable,
  "impact": "high/medium/low" if applicable
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a specialized assistant that detects vendor maintenance announcements, breaking changes, and service disruptions. Respond only in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in LLM response');
    }

    // Parse JSON response
    const classification: AnnouncementClassification = JSON.parse(content);
    
    // Validate required fields
    if (typeof classification.isVendorAnnouncement !== 'boolean') {
      throw new Error('Invalid LLM response format');
    }

    return classification;
  } catch (error) {
    console.error('LLM classification error:', error);
    // Return safe default
    return {
      isVendorAnnouncement: false,
      summary: ''
    };
  }
}

/**
 * Post formatted alert to Slack as a thread reply
 */
async function postSlackAlert(
  classification: AnnouncementClassification,
  originalEvent: SlackEvent,
  permalink: string | null,
  env: Env
): Promise<void> {
  // Use Slack mrkdwn format (single asterisks for bold)
  const alertText = `🚨 *VENDOR ANNOUNCEMENT DETECTED* <@williamliang82>

*Type:* ${classification.type || 'unknown'}
*Vendor:* ${classification.vendor || 'unknown'}
*Impact:* ${classification.impact || 'unknown'}

*Summary:*
${classification.summary}

*Original Message:* ${permalink || 'See message above'}

---
_Detected by automated monitoring_`;

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: originalEvent.channel,
        thread_ts: originalEvent.ts,  // This makes it a thread reply!
        text: alertText,
        mrkdwn: true,                 // Enable Slack markdown formatting
        unfurl_links: false,          // Prevent link previews in thread
        unfurl_media: false           // Prevent media previews in thread
      })
    });

    if (!response.ok) {
      throw new Error(`Slack API HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    console.log('Alert posted successfully as thread reply to Slack');
  } catch (error) {
    console.error('Failed to post Slack thread alert:', error);
    // Don't throw - continue processing
  }
}

/**
 * Get channel name from channel ID using Slack API
 */
async function getChannelName(channelId: string, env: Env): Promise<string | null> {
  try {
    // Construct URL with channel parameter
    const url = new URL('https://slack.com/api/conversations.info');
    url.searchParams.append('channel', channelId);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Slack API HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    if (!data.ok) {
      console.error('Slack API error getting channel info:', data.error);
      return null;
    }

    return data.channel?.name || null;
  } catch (error) {
    console.error('Failed to get channel name:', error);
    return null;
  }
}

/**
 * Detect if a message is from a bot to prevent infinite loops
 */
function isBotMessage(event: SlackEvent): boolean {
  // Method 1: Check for bot_id (most reliable)
  if (event.bot_id) {
    console.log('🤖 Bot message detected via bot_id:', event.bot_id);
    return true;
  }

  // Method 2: Check for bot_profile (very reliable)
  if (event.bot_profile) {
    console.log('🤖 Bot message detected via bot_profile:', event.bot_profile.name);
    return true;
  }

  // Method 3: Check for our content signature (backup)
  if (event.text?.includes('_Detected by automated monitoring_')) {
    console.log('🤖 Bot message detected via content signature');
    return true;
  }

  // Method 4: Check subtype for legacy bot detection
  if (event.subtype === 'bot_message') {
    console.log('🤖 Bot message detected via subtype: bot_message');
    return true;
  }

  return false;
}

/**
 * Process Slack message event
 */
async function processSlackMessage(body: SlackPayload, env: Env): Promise<Response> {
  const event = body.event;
  
  if (!event || event.type !== 'message') {
    console.log('Not a message event, ignoring');
    return new Response('OK', { status: 200 });
  }

  // 🛡️ INFINITE LOOP PREVENTION: Check if message is from a bot
  if (isBotMessage(event)) {
    console.log('🚫 Skipping bot message to prevent infinite loop');
    return new Response('OK', { status: 200 });
  }

  // Extract message text
  const messageText = event.text;
  if (!messageText) {
    console.log('No message text found');
    return new Response('No message text found', { status: 400 });
  }

  console.log('Processing message:', messageText);

  // Check if message is from monitored channel
  const channelId = event.channel;
  if (!channelId) {
    console.log('No channel ID found');
    return new Response('No channel ID found', { status: 400 });
  }

  // Filter by monitored channels (environment configured)
  if (!(await shouldMonitorChannel(channelId, env))) {
    console.log(`Skipping message from unmonitored channel: ${channelId}`);
    return new Response('OK', { status: 200 });
  }

  console.log(`✅ Processing message from monitored channel: ${channelId}`);

  // Classify message using LLM
  const classification = await classifyMessage(messageText, env);
  console.log('Classification result:', JSON.stringify(classification, null, 2));

  // If vendor announcement detected, post alert
  if (classification.isVendorAnnouncement) {
    console.log('Vendor announcement detected! Posting alert...');
    
    // Generate permalink
    const permalink = constructSlackPermalink(body, env.SLACK_WORKSPACE_DOMAIN);
    console.log('Permalink:', permalink);

    // Post alert as thread reply to original message
    await postSlackAlert(classification, event, permalink, env);
  } else {
    console.log('No vendor announcement detected');
  }

  return new Response('OK', { status: 200 });
}

/**
 * Main Worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Get request body
      const bodyText = await request.text();
      console.log('Received payload:', bodyText);

      let body: SlackPayload;
      try {
        body = JSON.parse(bodyText);
      } catch (error) {
        console.error('Invalid JSON payload:', error);
        return new Response('Invalid JSON', { status: 400 });
      }

      // Handle URL verification challenge
      if (body.type === 'url_verification') {
        console.log('URL verification challenge received');
        return new Response(
          JSON.stringify({ challenge: body.challenge }),
          { 
            headers: { 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      // Verify Slack signature (if signing secret is configured)
      if (env.SLACK_SIGNING_SECRET) {
        const isValidSignature = await verifySlackSignature(
          request, 
          bodyText, 
          env.SLACK_SIGNING_SECRET
        );

        if (!isValidSignature) {
          console.log('Invalid signature - rejecting request');
          return new Response('Unauthorized', { status: 401 });
        }
        console.log('Signature verification passed');
      } else {
        console.log('No signing secret configured - skipping signature verification');
      }

      // Process event callback
      if (body.type === 'event_callback') {
        return await processSlackMessage(body, env);
      }

      console.log('Unhandled event type:', body.type);
      return new Response('OK', { status: 200 });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(`Error: ${(error as Error).message}`, { status: 500 });
    }
  }
};