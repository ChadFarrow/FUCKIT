# 🔧 CDN Upload Issue Resolution Guide

## 🚨 Current Issue
The CDN is returning 404 errors for RSS feeds because the Bunny.net Pull Zone is configured to pull from Vercel instead of the Bunny.net Storage zone.

## 📊 Diagnosis Results
- ✅ **CDN Zone**: Working (re-podtards-cdn.b-cdn.net)
- ✅ **Storage Zone**: Working (re-podtards-storage)
- ❌ **Pull Zone Configuration**: Incorrect (pulling from Vercel instead of Storage)
- ❌ **API Keys**: Invalid or expired

## 🔧 Immediate Fix (Deployed)
The site is now working with original RSS feed URLs while the CDN is being reconfigured.

### Current Status
- ✅ **Site**: https://re.podtards.com - Working correctly
- ✅ **RSS Feeds**: Using original URLs via proxy
- ✅ **All Features**: Functional (backgrounds, audio, search, etc.)
- ⏳ **CDN**: Temporarily disabled until configuration is fixed

## 🛠️ Permanent Solution Options

### Option 1: Reconfigure CDN Pull Zone (Recommended)

1. **Login to Bunny.net Dashboard**
   - Go to: https://dash.bunny.net/
   - Navigate to: CDN → Pull Zones

2. **Find the "re-podtards" Pull Zone**
   - Look for Pull Zone ID: `4228588` (from CDN headers)
   - Current Origin: `https://re.podtards.com` (Vercel)

3. **Update Pull Zone Configuration**
   - **Origin URL**: Change to `https://ny.storage.bunnycdn.com/re-podtards-storage`
   - **Origin Type**: Storage Zone
   - **Zone**: re-podtards-storage

4. **Configure Settings**
   - **Cache Control**: `public, max-age=3600, s-maxage=86400`
   - **Enable Gzip**: Yes
   - **Enable Brotli**: Yes
   - **Custom Headers**: Add CORS headers if needed

5. **Test Configuration**
   ```bash
   curl -I "https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml"
   ```

6. **Re-enable CDN in Code**
   ```javascript
   // In app/page.tsx
   const isProduction = process.env.NODE_ENV === 'production';
   ```

### Option 2: Upload RSS Feeds Directly to CDN

If Pull Zone reconfiguration doesn't work, use the direct upload script:

1. **Update API Keys**
   - Get valid API keys from Bunny.net dashboard
   - Update `.env.local` with correct keys

2. **Run Upload Script**
   ```bash
   node scripts/upload-rss-to-cdn-direct.js
   ```

3. **Test Uploaded Feeds**
   ```bash
   curl -I "https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml"
   ```

### Option 3: Use Bunny.net Storage API

1. **Get Storage API Key**
   - Go to: Storage → re-podtards-storage → API
   - Copy the API key

2. **Upload RSS Feeds**
   ```bash
   node scripts/upload-all-rss-feeds.js
   ```

3. **Configure Pull Zone**
   - Set Origin to Storage zone URL

## 🔑 Required API Keys

### Current Environment Variables
```bash
# CDN Configuration
BUNNY_CDN_HOSTNAME=re-podtards-cdn.b-cdn.net
BUNNY_CDN_ZONE=re-podtards
BUNNY_CDN_API_KEY=your-cdn-api-key-here

# Storage Configuration
BUNNY_STORAGE_API_KEY=your-storage-key
BUNNY_STORAGE_HOSTNAME=ny.storage.bunnycdn.com
BUNNY_STORAGE_ZONE=re-podtards-storage
```

### How to Get New API Keys
1. **CDN API Key**: CDN → API → Generate new key
2. **Storage API Key**: Storage → re-podtards-storage → API → Copy key

## 📋 Verification Steps

### 1. Test CDN Zone
```bash
curl -I "https://re-podtards-cdn.b-cdn.net/"
```

### 2. Test Storage Zone
```bash
curl -s -H "AccessKey: YOUR_STORAGE_API_KEY" \
  "https://ny.storage.bunnycdn.com/re-podtards-storage/"
```

### 3. Test Pull Zone
```bash
curl -I "https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml"
```

### 4. Test Site Functionality
- Visit: https://re.podtards.com
- Check RSS feed loading
- Verify album pages work
- Test background images

## 🚀 Deployment Steps

### After CDN Configuration
1. **Re-enable CDN**
   ```javascript
   // In app/page.tsx
   const isProduction = process.env.NODE_ENV === 'production';
   ```

2. **Deploy to Production**
   ```bash
   git add .
   git commit -m "Re-enable CDN after configuration fix"
   git push
   vercel --prod
   ```

3. **Verify Deployment**
   - Check site loads correctly
   - Verify RSS feeds load from CDN
   - Test all features work

## 📞 Support Resources

### Bunny.net Documentation
- [Pull Zones](https://docs.bunny.net/docs/cdn#pull-zones)
- [Storage API](https://docs.bunny.net/docs/storage-api)
- [CDN API](https://docs.bunny.net/docs/cdn-api)

### Current Working URLs
- **Site**: https://re.podtards.com
- **CDN**: https://re-podtards-cdn.b-cdn.net
- **Storage**: https://ny.storage.bunnycdn.com/re-podtards-storage

## 🎯 Success Criteria

The CDN upload issue is resolved when:
- ✅ RSS feeds load from CDN URLs
- ✅ No 404 errors on CDN requests
- ✅ Site performance is improved
- ✅ All features work correctly
- ✅ Background images load properly

## 🔄 Next Steps

1. **Choose a solution option** (Pull Zone reconfiguration recommended)
2. **Update API keys** if needed
3. **Configure CDN** according to chosen option
4. **Test thoroughly** before re-enabling CDN
5. **Deploy changes** and verify functionality

---

*Last Updated: January 23, 2025*  
*Status: Temporary fix deployed, permanent solution pending CDN configuration* 