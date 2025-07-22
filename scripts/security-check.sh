#!/bin/bash

# Security check script to prevent API key commits
echo "🔒 Running security checks..."

# Check for API keys in staged files
if git diff --cached --name-only | xargs grep -l "BUNNY_CDN_API_KEY" 2>/dev/null; then
    echo "❌ ERROR: API key found in staged files!"
    echo "Please remove API keys before committing."
    echo "Use .env.local for actual keys (already gitignored)."
    exit 1
fi

# Check for common API key patterns
if git diff --cached | grep -E "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}" 2>/dev/null; then
    echo "❌ WARNING: Possible API key pattern detected!"
    echo "Please verify this is not a real API key before committing."
    exit 1
fi

echo "✅ Security checks passed!"
exit 0 