#!/bin/bash

echo "🔄 Regenerating optimized album cache..."

# Navigate to project directory
cd "$(dirname "$0")/.."

# Run the cache generation script
node scripts/create-optimized-cache.js

if [ $? -eq 0 ]; then
    echo "✅ Cache regenerated successfully"
else
    echo "❌ Cache regeneration failed"
    exit 1
fi
