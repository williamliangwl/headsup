#!/bin/bash

echo "🧪 Testing Vendor Announcement Detection System Locally"
echo "========================================================"
echo ""
echo "🔧 Features being tested:"
echo "• Channel name filtering (monitors 'new-channel')"
echo "• LLM-powered vendor announcement detection"
echo "• Thread reply alerts with @williamliang82 mention"
echo "• Bot message infinite loop prevention"
echo "• Slack mrkdwn formatting"
echo ""

LOCAL_URL="http://localhost:8787"

echo "✅ Test 1: Health Check (GET /)"
echo "--------------------------------"
curl -X GET $LOCAL_URL
echo -e "\n"

echo "✅ Test 2: URL Verification Challenge"
echo "------------------------------------"
curl -X POST $LOCAL_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-verification.json
echo -e "\n"

echo "✅ Test 3: AWS Maintenance Announcement (should trigger alert)"
echo "-------------------------------------------------------------"
curl -X POST $LOCAL_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-payload.json
echo -e "\n"

echo "✅ Test 4: Stripe Breaking Change (should trigger alert)"
echo "-------------------------------------------------------"
curl -X POST $LOCAL_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-breaking-change.json
echo -e "\n"

echo "✅ Test 5: GitHub Outage (should trigger alert)"
echo "-----------------------------------------------"
curl -X POST $LOCAL_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-outage.json
echo -e "\n"

echo "✅ Test 6: Normal Message (should be ignored)"
echo "--------------------------------------------"
curl -X POST $LOCAL_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-normal-message.json
echo -e "\n"

echo "✅ Test 7: Bot Message (should be skipped - infinite loop prevention)"
echo "--------------------------------------------------------------------"
curl -X POST $LOCAL_URL \
  -H "Content-Type: application/json" \
  -d @test/test-slack-bot-message.json
echo -e "\n"

echo "🎉 All tests completed!"
echo ""
echo "📋 Expected Results:"
echo "• Tests 1-2: Basic functionality checks"
echo "• Tests 3-5: Should classify as vendor announcements and trigger alerts"
echo "• Test 6: Should classify as normal message, no alert"
echo "• Test 7: Should be skipped entirely (bot detection)"
echo ""
echo "📝 Note: Channel filtering will apply - only 'new-channel' is monitored"
echo "💡 To test live: Post similar messages in your #new-channel on Slack"