#!/bin/bash

echo "🔧 Fixing Mobile Issues..."
echo "=========================="

# Stop the development server if it's running
echo "🛑 Stopping development server..."
pkill -f "next dev" || true

# Clear Next.js cache
echo "🗑️ Clearing Next.js cache..."
rm -rf .next

# Clear service worker files
echo "🗑️ Clearing service worker files..."
rm -f public/sw.js
rm -f public/workbox-*.js

# Clear browser cache files
echo "🗑️ Clearing browser cache files..."
rm -rf .cache

# Install dependencies if needed
echo "📦 Checking dependencies..."
npm install

# Rebuild the application
echo "🔨 Rebuilding application..."
npm run build

# Start development server
echo "🚀 Starting development server..."
npm run dev &

echo ""
echo "✅ Mobile issues fix complete!"
echo ""
echo "📱 Next steps:"
echo "1. Open your browser"
echo "2. Go to Developer Tools (F12)"
echo "3. Go to Application tab"
echo "4. Click 'Clear storage' → 'Clear site data'"
echo "5. Refresh the page"
echo "6. Test /test-mobile-images"
echo ""
echo "🌐 Test URL: http://localhost:3000/test-mobile-images" 