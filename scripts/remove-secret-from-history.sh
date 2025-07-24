#!/bin/bash

echo "🔒 SECURITY: Removing exposed API key from Git history"
echo ""
echo "⚠️  WARNING: This will rewrite Git history and force push to remote"
echo "⚠️  Make sure you have a backup of your repository"
echo ""
echo "The exposed API key: d33f9b6a-779d-4cce-8767-cd050a2819bf"
echo ""

read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled"
    exit 1
fi

echo "🔄 Removing secret from Git history..."

# Use BFG Repo-Cleaner if available, otherwise use git filter-branch
if command -v bfg &> /dev/null; then
    echo "📦 Using BFG Repo-Cleaner..."
    bfg --replace-text <(echo "d33f9b6a-779d-4cce-8767-cd050a2819bf") .
    git reflog expire --expire=now --all && git gc --prune=now --aggressive
else
    echo "📦 Using git filter-branch..."
    git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch scripts/check-new-pullzone-status.js scripts/check-storage-zone-status.js' \
        --prune-empty --tag-name-filter cat -- --all
fi

echo ""
echo "✅ Secret removed from Git history"
echo ""
echo "🚨 IMPORTANT NEXT STEPS:"
echo "1. Revoke the API key in Bunny.net dashboard"
echo "2. Generate a new API key"
echo "3. Update your environment variables"
echo "4. Force push to remote: git push --force-with-lease"
echo ""
echo "💡 To use the new secure script:"
echo "   export BUNNY_API_KEY=\"your-new-api-key\""
echo "   node scripts/check-bunny-status-secure.js pullzone" 