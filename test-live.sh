#!/bin/bash

echo "🚀 Testing Live Vendor Announcement Detection System"
echo "===================================================="
echo ""
echo "🌐 Production URL: https://vendor-announcement-detector.william-e8c.workers.dev"
echo ""
echo "🔧 Live Features:"
echo "• Channel filtering: monitors 'new-channel'"
echo "• @williamliang82 mentions in alerts"
echo "• Thread replies (not new messages)"
echo "• Bot loop prevention"
echo "• Slack mrkdwn formatting"
echo ""

PROD_URL="https://vendor-announcement-detector.william-e8c.workers.dev"

echo "✅ Test 1: URL Verification Challenge"
echo "------------------------------------"
curl -X POST $PROD_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-verification.json
echo -e "\n"

echo "✅ Test 2: AWS Maintenance (should trigger alert in production)"
echo "--------------------------------------------------------------"
curl -X POST $PROD_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-payload.json
echo -e "\n"

echo "✅ Test 3: Stripe Breaking Change (should trigger alert)"
echo "-------------------------------------------------------"
curl -X POST $PROD_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-breaking-change.json
echo -e "\n"

echo "✅ Test 4: Normal Message (should be ignored)"
echo "--------------------------------------------"
curl -X POST $PROD_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-normal-message.json
echo -e "\n"

echo "✅ Test 5: Bot Message (should be skipped)"
echo "-----------------------------------------"
curl -X POST $PROD_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-bot-message.json
echo -e "\n"

echo "🎉 Live system tests completed!"
echo ""
echo "⚠️  IMPORTANT: These tests use mock channel IDs that won't match your actual channels"
echo "💡 For real testing: Post vendor announcements directly in your #new-channel on Slack"
echo ""
echo "📋 Sample messages to test in Slack:"
echo ""
echo "1. AWS Maintenance:"
echo "🚨 SCHEDULED MAINTENANCE: AWS RDS will undergo maintenance in us-east-1 region on December 20, 2024, from 02:00 to 04:00 UTC. Expected downtime: 5-10 minutes."
echo ""
echo "2. Breaking Change:"
echo "🔥 BREAKING: Stripe API v2024-04-10 will be deprecated on January 31, 2025. All integrations must migrate to v2024-10-28."
echo ""
echo "3. Outage:"
echo "⚠️  GitHub is experiencing elevated error rates for Git operations. Engineers are investigating."