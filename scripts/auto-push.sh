#!/bin/bash

# Auto-push script for development
# Usage: ./scripts/auto-push.sh "commit message"

if [ -z "$1" ]; then
    echo "❌ Please provide a commit message"
    echo "Usage: ./scripts/auto-push.sh \"commit message\""
    exit 1
fi

echo "🔄 Adding all changes..."
git add .

echo "📝 Committing with message: $1"
git commit -m "$1

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "🚀 Pushing to GitHub..."
git push

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo "🌐 Your changes are now live!"
else
    echo "❌ Failed to push to GitHub"
    exit 1
fi