#!/bin/bash

# Deploy with Cache Fix Script
# This script deploys the application with fixes for production cache issues

set -e

echo "🚀 Starting deployment with cache fixes..."

# Clear all caches first
echo "🧹 Clearing all caches..."
node scripts/force-clear-cache.js

# Build the project
echo "🔨 Building project..."
npm run build

# Create a deployment info file
echo "📝 Creating deployment info..."
cat > public/deployment-info.json << EOF
{
  "deploymentTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "$(node -p "require('./package.json').version")",
  "buildId": "$(date +%s)",
  "cacheBusting": true,
  "fixes": [
    "Fixed shuffle state management",
    "Added recursion error prevention",
    "Added cache busting scripts",
    "Fixed album loading issues",
    "Added global error pages"
  ]
}
EOF

# Create a cache-busting version file
echo "📝 Creating cache-busting version file..."
cat > public/version.txt << EOF
$(date +%s)
$(node -p "require('./package.json').version")
$(git rev-parse HEAD 2>/dev/null || echo "unknown")
EOF

echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Deploy the .next folder and public folder to your hosting provider"
echo "2. Users experiencing issues can visit:"
echo "   - /clear-cache.html (to clear browser cache)"
echo "   - /force-clear-cache.js (to run cache clearing script)"
echo "   - /deployment-info.json (to check deployment status)"
echo ""
echo "The new build includes:"
echo "✅ Fixed shuffle functionality"
echo "✅ Recursion error prevention"
echo "✅ Cache busting mechanisms"
echo "✅ Global error handling"
echo "✅ Album loading improvements" 