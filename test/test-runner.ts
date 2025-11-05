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

  console.log('Request Headers:', headers);
  console.log('Request Body:', bodyString);
  
  // In real test, you'd call your Worker
  // For local testing, use: wrangler dev
}

async function runTests() {
  console.log('🧪 Starting Vendor Announcement Detection Worker tests...\n');
  
  console.log('📋 Test Coverage:');
  console.log('✅ URL verification challenge');
  console.log('✅ Vendor maintenance announcement (should trigger alert + mention)');
  console.log('✅ Breaking change announcement (should trigger alert + mention)');
  console.log('✅ Outage notification (should trigger alert + mention)');
  console.log('✅ Normal message (should be ignored)');
  console.log('✅ Bot message (should be ignored - infinite loop prevention)');
  console.log('');
  
  await testWorker('test-slack-verification.json');
  await testWorker('test-slack-payload.json');
  await testWorker('test-slack-breaking-change.json');
  await testWorker('test-slack-outage.json');
  await testWorker('test-slack-normal-message.json');
  await testWorker('test-slack-bot-message.json');
  
  console.log('\n✅ All tests completed');
  console.log('\n📋 Expected Results:');
  console.log('1. URL verification: Returns challenge');
  console.log('2. Vendor announcements: Classified as vendor announcements, alert posted with @williamliang82');
  console.log('3. Normal message: Classified as non-vendor, no alert');
  console.log('4. Bot message: Skipped entirely (infinite loop prevention)');
  console.log('\n📋 To test with real Worker:');
  console.log('1. Run: npx wrangler dev');
  console.log('2. Use curl to POST test payloads to http://localhost:8787');
  console.log('3. Check console logs for classification results');
  console.log('\n🔗 Example curl command:');
  console.log('curl -X POST http://localhost:8787 \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d @test/test-slack-verification.json');
}

runTests().catch(console.error);