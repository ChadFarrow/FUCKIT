# 🎵 FUCKIT - Music Site Build Log

## 📋 Project Overview
**Project Name:** FUCKIT (Podcast & Music Hub)  
**Domain:** https://re.podtards.com  
**Framework:** Next.js 15.4.2  
**Deployment:** Vercel  
**CDN:** Bunny.net  

---

## 🚀 Quick Start Commands

### Development
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm start           # Start production server
```

### Git Operations
```bash
git status          # Check current changes
git add .           # Stage all changes
git commit -m "message"  # Commit changes
git push            # Push to GitHub
```

### Deployment
```bash
vercel --prod       # Deploy to production
vercel              # Deploy to preview
```

---

## 🔧 Environment Configuration

### Local Environment (.env.local)
```bash
# Bunny.net CDN Configuration for re.podtards.com
BUNNY_CDN_HOSTNAME=re-podtards.b-cdn.net
BUNNY_CDN_ZONE=re-podtards
BUNNY_CDN_API_KEY=d33f9b6a-779d-4cce-8767-cd050a2819bf

# CDN URLs
NEXT_PUBLIC_CDN_URL=https://re-podtards.b-cdn.net

# Site Configuration  
NEXT_PUBLIC_SITE_URL=https://re.podtards.com
NEXT_PUBLIC_API_URL=https://re.podtards.com/api

# Environment
NODE_ENV=development

# Optional: Custom Domain for Images
NEXT_PUBLIC_IMAGE_DOMAIN=re.podtards.com
```

### Vercel Configuration (vercel.json)
```json
{
  "env": {
    "BUNNY_CDN_HOSTNAME": "re-podtards.b-cdn.net",
    "BUNNY_CDN_ZONE": "re-podtards", 
    "BUNNY_CDN_API_KEY": "d33f9b6a-779d-4cce-8767-cd050a2819bf",
    "NEXT_PUBLIC_SITE_URL": "https://re.podtards.com",
    "NEXT_PUBLIC_API_URL": "https://re.podtards.com/api",
    "NEXT_PUBLIC_CDN_URL": "https://re-podtards.b-cdn.net"
  }
}
```

---

## 🌐 Domain & DNS Configuration

### Custom Domain Setup
- **Domain:** re.podtards.com
- **DNS Type:** CNAME
- **Target:** d9d5547842e2782f.vercel-dns-016.com
- **TTL:** 4 hours
- **Status:** Active ✅

### Vercel Domain Verification
- Domain is properly configured in Vercel dashboard
- SSL certificate is active
- DNS propagation completed

---

## 📡 RSS Feed Configuration

### Default RSS Feeds (65 total)
**Doerfels Family Feeds:**
- Main feeds: music-from-the-doerfelverse.xml, bloodshot-lies-album.xml, intothedoerfelverse.xml
- Additional albums: 18sundays.xml, alandace.xml, autumn.xml, christ-exalted.xml, etc.
- Ed Doerfel projects: Nostalgic.xml, CityBeach.xml, Kurtisdrums-V1.xml
- TJ Doerfel projects: ring-that-bell.xml

**Wavlake Feeds:**
- Nate Johnivan collection (Tinderbox, artist feeds)
- Joe Martin collection (Empty Passenger Seat, various albums)
- Multiple music and artist feeds

### RSS Feed Addition Feature
- **Passphrase:** "doerfel" (case-insensitive)
- **Component:** `components/AddRSSFeed.tsx`
- **Functionality:** Dynamic RSS feed addition with validation
- **Security:** Passphrase protection prevents unauthorized additions

---

## 🏗️ Project Structure

```
FUCKIT/
├── app/
│   ├── page.tsx                 # Main homepage
│   ├── album/[id]/page.tsx      # Individual album pages
│   ├── api/fetch-rss/route.ts   # RSS proxy endpoint
│   └── layout.tsx               # Root layout
├── components/
│   ├── AddRSSFeed.tsx           # RSS feed addition component
│   ├── Header.tsx               # Site header
│   ├── LoadingSpinner.tsx       # Loading component
│   └── SearchBar.tsx            # Search functionality
├── lib/
│   ├── cdn-utils.ts             # CDN image optimization
│   └── rss-parser.ts            # RSS parsing utilities
├── types/
│   └── music.ts                 # TypeScript type definitions
├── public/                      # Static assets
├── .env.local                   # Local environment variables
├── vercel.json                  # Vercel deployment config
└── BUILD_LOG.md                 # This file
```

---

## 🔑 API Keys & Credentials

### Bunny.net CDN
- **API Key:** 52208757-f03f-47a3-ad5d-da1be0d11122
- **Hostname:** re-podtards.b-cdn.net
- **Zone:** re-podtards
- **Status:** Active ✅

### Vercel
- **Project:** FUCKIT
- **Team:** Personal
- **Auto-deploy:** Enabled
- **Domain:** re.podtards.com

---

## 🛠️ Key Features Implemented

### ✅ Core Functionality
- RSS feed parsing and display
- Album grid with cover art
- Individual album pages with track listings
- Search functionality across albums
- PodRoll feature (related albums)
- Responsive design for all devices

### ✅ RSS Feed Management
- Dynamic RSS feed addition (passphrase protected)
- Custom feed management (add/remove)
- Real-time feed loading
- Error handling and validation

### ✅ CDN Integration
- Bunny.net image optimization
- Automatic image resizing
- Fast global content delivery
- Fallback image handling

### ✅ CORS Resolution
- Backend proxy for RSS feeds (`/api/fetch-rss`)
- Eliminated direct frontend fetches
- Proper error handling for failed requests

---

## 🚨 Troubleshooting Guide

### Common Issues & Solutions

#### 1. CORS Errors
**Problem:** Cross-origin request blocked
**Solution:** All RSS feeds are proxied through `/api/fetch-rss` endpoint

#### 2. RSS Parser Errors
**Problem:** "Direct fetch failed, trying proxy"
**Solution:** RSSParser now always uses proxy - no direct fetches

#### 3. Vercel Deployment Issues
**Problem:** Invalid configuration errors
**Solution:** Use `vercel.json` with direct environment variables (not secrets)

#### 4. Domain Configuration
**Problem:** Domain not resolving
**Solution:** Verify DNS CNAME record points to Vercel endpoint

#### 5. CDN Image Issues
**Problem:** Images not loading
**Solution:** Check Bunny.net API key and zone configuration

#### 6. Development Server Webpack Errors
**Problem:** `TypeError: __webpack_modules__[moduleId] is not a function`
**Solution:** Clear `.next` cache: `rm -rf .next && npm run dev`

#### 7. Image Priority Conflicts
**Problem:** `Image with src "..." has both "priority" and "loading='lazy'" properties`
**Solution:** Use conditional loading: `loading={priority ? undefined : "lazy"}`

#### 8. Multiple Lockfiles Warning
**Problem:** `Warning: Found multiple lockfiles`
**Solution:** Remove conflicting package-lock.json files from parent directories

#### 9. Production CDN Asset Loading Errors
**Problem:** `OpaqueResponseBlocking` errors for JavaScript/CSS files from CDN
**Solution:** Temporarily disable CDN asset prefix in `next.config.js` until static assets are uploaded to CDN

### Debug Commands
```bash
# Test RSS proxy
curl "https://re.podtards.com/api/fetch-rss?url=https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml"

# Test domain
curl -s "https://re.podtards.com/" | head -10

# Check environment
cat .env.local
```

---

## 📊 Performance Metrics

### Current Status
- **65 RSS Feeds** loaded successfully
- **All API endpoints** responding (200 status)
- **CDN integration** working
- **Custom domain** active
- **Passphrase protection** implemented
- **Development server** running cleanly (no warnings)
- **Image optimization** fully functional
- **Error handling** comprehensive

### Load Times
- **Initial page load:** ~2-3 seconds
- **RSS feed parsing:** 100-2000ms per feed
- **Image optimization:** Via Bunny.net CDN

---

## 🔄 Recent Updates

### Latest Changes (Commit: 21621b4) - January 22, 2025
- ✅ **Fixed Production CDN Asset Loading** - Resolved OpaqueResponseBlocking errors from Bunny.net CDN
- ✅ **Static Asset Configuration** - Temporarily disabled CDN asset prefix to serve assets from Vercel
- ✅ **Production Environment Variables** - Added all required env vars to Vercel production environment
- ✅ **RSS API Functionality** - Confirmed API working correctly in production (41 items returned from test feed)
- ✅ **Production Deployment** - Successfully deployed with working static assets and API endpoints

### Previous Changes (Commit: a6706b8) - January 22, 2025
- ✅ **Fixed Development Server Issues** - Resolved webpack module loading errors
- ✅ **Image Priority Optimization** - Fixed conflicts between `priority` and `loading="lazy"` props
- ✅ **LCP Image Enhancement** - Added priority loading for logo image (above-the-fold element)
- ✅ **Error Handling Improvements** - Enhanced image fallback handling for missing artwork
- ✅ **Lockfile Cleanup** - Removed conflicting package-lock.json files from parent directories
- ✅ **Album Detail Improvements** - Better error handling for track and album images
- ✅ **Development Experience** - Eliminated console warnings and errors

### Previous Changes (Commit: 9b8ab95)
- ✅ **API Response Caching** - RSS feed responses cached for 5 minutes
- ✅ **Static Site Generation** - Album pages pre-generated at build time
- ✅ **Service Worker Caching** - Offline functionality with intelligent caching
- ✅ **PWA Support** - Web app manifest and service worker registration
- ✅ **Offline Page** - Custom offline experience for users
- ✅ Added RSS feed addition feature with passphrase protection
- ✅ Implemented custom feed management
- ✅ Fixed CORS issues completely
- ✅ Deployed to production with custom domain
- ✅ Added comprehensive error handling

### Next Steps
- [ ] Implement feed persistence (localStorage/database)
- [ ] Add feed categories/tags
- [ ] Implement user preferences
- [ ] Add analytics tracking
- [ ] Optimize image loading performance

---

## 📞 Support & References

### Useful Links
- **Live Site:** https://re.podtards.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Bunny.net Dashboard:** https://dash.bunny.net/
- **GitHub Repository:** https://github.com/ChadFarrow/FUCKIT

### Key Files to Check
- `app/page.tsx` - Main homepage logic
- `lib/rss-parser.ts` - RSS parsing core
- `app/api/fetch-rss/route.ts` - CORS proxy
- `components/AddRSSFeed.tsx` - Feed addition feature

### Environment Variables Reference
```bash
# Required for local development
# ⚠️ SECURITY: Never commit real API keys to Git!
# Use .env.local for actual keys (already gitignored)
BUNNY_CDN_HOSTNAME=re-podtards.b-cdn.net
BUNNY_CDN_ZONE=re-podtards
BUNNY_CDN_API_KEY=YOUR_API_KEY_HERE
NEXT_PUBLIC_CDN_URL=https://re-podtards.b-cdn.net
NEXT_PUBLIC_SITE_URL=https://re.podtards.com
NEXT_PUBLIC_API_URL=https://re.podtards.com/api
```

---

## 🎯 Quick Session Start Checklist

1. **Load environment:** `source .env.local` (if needed)
2. **Start dev server:** `npm run dev`
3. **Check domain:** Visit https://re.podtards.com
4. **Test RSS proxy:** Check browser console for errors
5. **Verify CDN:** Check image loading
6. **Test passphrase:** Try adding RSS feed with "doerfel"

---

*Last Updated: January 22, 2025*  
*Build Status: ✅ Production Ready*  
*Domain Status: ✅ Active*  
*CDN Status: ✅ Operational*  
*Development Status: ✅ Clean (No Warnings)* 