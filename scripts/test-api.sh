#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3000}"

echo "Health check..."
curl -fsS "$API_URL/health" | tee /tmp/health.json
echo ""

echo "Login as alice..."
TOKEN=$(curl -fsS -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"test1234"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

echo "Profile..."
curl -fsS "$API_URL/me" -H "Authorization: Bearer $TOKEN"
echo ""

echo "Join hub..."
JOIN_JSON=$(curl -fsS -X POST "$API_URL/world/join-hub" -H "Authorization: Bearer $TOKEN")
echo "$JOIN_JSON"
JOIN_TOKEN=$(echo "$JOIN_JSON" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).joinToken))")
echo ""

echo "Validate hub join token..."
curl -fsS -X POST "$API_URL/world/validate-hub-join" \
  -H 'Content-Type: application/json' \
  -d "{\"joinToken\":\"$JOIN_TOKEN\"}"
echo ""

echo "API smoke test passed."
