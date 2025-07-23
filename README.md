# DoerfelVerse - Music & Podcast Hub 🎵

A modern PWA (Progressive Web App) built with Next.js for discovering and streaming music and podcasts from RSS feeds. Experience the DoerfelVerse collection and curated indie artists with a native app-like experience.

🌐 **Live Site:** [re.podtards.com](https://re.podtards.com)  
📦 **Current Version:** v1.0.0-stable

## ✨ Features

### 🎵 **Music & Podcast Streaming**
- Stream music from 100+ RSS feeds including The Doerfels, Wavlake artists, and indie musicians
- Individual album pages with full-featured audio players
- Track navigation, progress bars, and volume controls
- Podcasting 2.0 support with funding links and publisher metadata
- **Persistent audio playback** across page navigation
- **Global audio state management** with localStorage

### 🎨 **Dynamic Visual Experience**
- **Rotating album artwork backgrounds** on desktop (mobile-optimized)
- **Reactive album page backgrounds** that update automatically
- **Mobile-optimized solid backgrounds** for better performance
- **Smooth transitions** and immersive visual experience

### 📱 **Progressive Web App (PWA)**
- **Install as native app** on iOS and Android devices
- **Offline functionality** with intelligent caching
- **30-second automatic updates** with user-friendly notifications
- **Background sync** for faster loading
- **Push notification ready** for future features

### ⚡ **Performance & CDN**
- **Bunny.net CDN integration** for global image optimization
- **RSS feed caching** on CDN for lightning-fast loading
- **Environment-aware URLs** (dev vs production)
- **Progressive image loading** with WebP support
- **Mobile performance optimization** with device-specific features

### 🚀 **Developer Experience**
- **Automated PWA versioning** on every deployment
- **Git-based version generation** for cache busting
- **Comprehensive error handling** and debugging
- **TypeScript throughout** for type safety
- **Stable version tagging** for safe experimentation

## 🏗️ Architecture

### **Frontend**
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Service Worker** for PWA functionality

### **Backend**
- **RSS Parser** with cross-origin proxy
- **Bunny.net CDN** for asset delivery
- **Vercel** for hosting and deployment

### **PWA Features**
- **Service Worker** with smart caching strategies
- **Web App Manifest** with proper icons and metadata
- **Automatic updates** with user notifications
- **Offline support** with fallback pages

### **Audio System**
- **Global audio state management** with localStorage persistence
- **Cross-page audio playback** without interruption
- **Media Session API** for iOS lock screen controls
- **Automatic track progression** and playlist management

## 🚀 Quick Start

### **Local Development**
```bash
# Clone the repository
git clone <repository-url>
cd FUCKIT

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Bunny.net credentials

# Start development server
npm run dev
```

### **PWA Testing**
```bash
# Build for production
npm run build

# Start production server
npm run start

# Test PWA installation on mobile device
# Visit localhost:3000 on your phone and "Add to Home Screen"
```

## 📱 PWA Installation

### **iOS (Safari)**
1. Visit the site in Safari
2. Tap the share button
3. Select "Add to Home Screen"
4. Enjoy native app experience!

### **Android (Chrome)**
1. Visit the site in Chrome
2. Tap "Install App" prompt (automatic)
3. Or use "Add to Home Screen" from menu
4. Launch from home screen like any native app!

## 🔧 Configuration

### **Environment Variables**
```bash
# Bunny.net CDN Configuration
BUNNY_CDN_HOSTNAME=your-zone.b-cdn.net
BUNNY_CDN_ZONE=your-zone-name
BUNNY_CDN_API_KEY=your-api-key

# Bunny.net Storage (for RSS feed caching)
BUNNY_STORAGE_API_KEY=your-storage-key
BUNNY_STORAGE_HOSTNAME=ny.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=your-storage-zone

# Site Configuration
NEXT_PUBLIC_CDN_URL=https://your-zone.b-cdn.net
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NODE_ENV=production
```

### **RSS Feed Management**
Add new RSS feeds by editing the `feedUrlMappings` array in `/app/page.tsx`:

```typescript
const feedUrlMappings = [
  ['https://original-feed-url.xml', 'https://your-cdn.b-cdn.net/feeds/cached-feed.xml'],
  // Add your feeds here
];
```

## 🚀 Deployment

### **Automatic Deployment (Recommended)**
```bash
# Push to main branch - everything happens automatically!
git push origin main

# The following happens automatically:
# 1. PWA version updates to git commit hash
# 2. Service worker cache invalidation
# 3. Vercel deployment
# 4. Users get update notifications within 30 seconds
```

### **Manual Deployment**
```bash
# Update PWA version manually
npm run update-version

# Deploy with version update
npm run deploy
```

### **PWA Version Management**
The app automatically versions the PWA using git commit hashes:
- **Main branch:** `1.abc1234`
- **Dev branches:** `dev.abc1234`
- **Manual updates:** `npm run update-version`

## 🛠️ Scripts

### **Development**
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### **PWA Management**
```bash
npm run update-version   # Update PWA version manually
npm run prebuild         # Auto-version before build (runs automatically)
```

### **Testing & Utilities**
```bash
npm run test-feeds       # Test all RSS feeds
npm run setup-cdn        # Upload assets to CDN
npm run dev-setup        # Initialize development environment
```

## 📊 PWA Performance

### **Update Speed**
- **Before:** Hours/days for users to see updates
- **Now:** **30 seconds** with automatic notifications

### **Offline Capabilities**
- **RSS feeds:** Cached for 1 hour
- **Images:** Cached with fallbacks
- **Static assets:** Cached with background updates
- **Pages:** Network-first with cache fallback

### **Installation Metrics**
- **Icon sizes:** All required sizes for iOS/Android
- **Manifest:** Complete with shortcuts and categories
- **Service Worker:** Advanced caching strategies
- **Performance:** Lighthouse PWA score 95+

## 🎵 Music Sources

### **The Doerfels Collection**
- 30+ albums from the Doerfel family
- Ed Doerfel (Shredward) projects
- TJ Doerfel solo work

### **Featured Artists**
- **Able and the Wolf** - Stay Awhile
- **Death Dreams** - Various releases
- **Vance Latta** - Love In Its Purest Form
- **C Kostra & Mellow Cassette** - Electronic music

### **Wavlake Artists**
- **Nate Johnivan** collection
- **Joe Martin** complete discography
- Various Bitcoin music artists

## 🔄 Auto-Update System

The PWA features an advanced auto-update system:

1. **Version Detection:** Git commit hash generates unique versions
2. **Cache Invalidation:** New versions force cache refresh
3. **User Notifications:** Friendly update prompts with "Reload Now" buttons
4. **Background Updates:** Service worker updates automatically
5. **Seamless Experience:** Updates apply without user disruption

## 🛡️ Security

- **HTTPS required** for PWA functionality
- **CSP headers** for security
- **CORS properly configured** for RSS feed access
- **No sensitive data exposure** in client-side code

## 📱 Browser Support

### **PWA Installation**
- ✅ **iOS Safari** 11.3+
- ✅ **Android Chrome** 76+
- ✅ **Desktop Chrome** 76+
- ✅ **Desktop Edge** 79+

### **Audio Playback**
- ✅ **All modern browsers**
- ✅ **Mobile optimized** controls
- ✅ **Background playback** support

## 🐛 Troubleshooting

### **PWA Not Installing**
1. Ensure HTTPS is enabled
2. Check manifest.json is accessible
3. Verify service worker registration
4. Test with different browsers

### **Audio Issues**
1. Check RSS feed URLs are accessible
2. Verify CORS headers on audio files
3. Test with different audio formats

### **Update Problems**
1. Clear browser cache
2. Unregister service worker in DevTools
3. Check console for update notifications

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is private and proprietary.

## 🎵 Credits

Built with ❤️ for The Doerfels and the indie music community.

**Special Thanks:**
- The Doerfel family for the amazing music
- All featured artists for sharing their work
- Podcasting 2.0 community for RSS standards
- Wavlake for supporting independent artists

---

**Enjoy the music! 🎵** Install the PWA for the best experience.