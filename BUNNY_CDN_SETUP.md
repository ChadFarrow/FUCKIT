# 🚨 URGENT: Fix Bunny.net CDN 403 Errors

## 🔍 **Problem Identified**
Your RSS feeds are getting **HTTP 403 Forbidden** errors because:
- RSS feeds are uploaded to **Bunny.net Storage** (requires auth)
- CDN is trying to serve them directly (no access)
- **Missing Pull Zone** to bridge Storage → CDN

## 🛠️ **Solution: Create Pull Zone**

### Step 1: Login to Bunny.net Dashboard
1. Go to [https://dash.bunny.net/](https://dash.bunny.net/)
2. Login with your credentials

### Step 2: Create Pull Zone
1. Go to **CDN** → **Pull Zones**
2. Click **"Add Pull Zone"**
3. Configure with these settings:

```
Pull Zone Name: re-podtards-feeds
Origin Type: Storage Zone
Origin URL: re-podtards-storage
Zone: re-podtards
```

### Step 3: Configure Pull Zone Settings
1. **General Settings:**
   - **Cache Control:** `public, max-age=3600` (1 hour for RSS feeds)
   - **Enable Gzip:** ✅ Yes
   - **Enable Brotli:** ✅ Yes

2. **Security Settings:**
   - **Access Control:** Disabled (for public RSS feeds)
   - **Token Authentication:** Disabled

3. **Optimization:**
   - **Optimize Images:** ✅ Yes
   - **WebP Support:** ✅ Yes

### Step 4: Test the Configuration
```bash
# Test RSS feed access
curl -I "https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml"

# Should return HTTP 200 instead of 403
```

## 🔧 **Alternative: Direct CDN Upload**

If Pull Zone setup is complex, you can upload RSS feeds directly to CDN:

### Option A: Use CDN Upload Script
```bash
# Run the CDN upload script
node scripts/upload-rss-feeds.js
```

### Option B: Manual CDN Upload
1. Go to **CDN** → **re-podtards** → **Files**
2. Create `/feeds/` folder
3. Upload RSS XML files directly to CDN

## 🚀 **Quick Fix: Re-enable CDN**

Once Pull Zone is configured, re-enable CDN in your code:

```typescript
// In app/page.tsx, change line 12:
const isProduction = process.env.NODE_ENV === 'production';
```

## 📊 **Verification Steps**

1. **Test CDN Access:**
   ```bash
   curl -I "https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml"
   ```

2. **Check Browser Network Tab:**
   - Open https://re.podtards.com
   - Look for successful CDN requests (200 status)

3. **Verify RSS Feed Loading:**
   - Check browser console for no 403 errors
   - Confirm albums are loading from CDN URLs

## 🆘 **If Still Having Issues**

### Check Bunny.net Configuration:
1. **Storage Zone:** `re-podtards-storage` (✅ Active)
2. **CDN Zone:** `re-podtards` (✅ Active)  
3. **Pull Zone:** `re-podtards-feeds` (⏳ Needs setup)

### Environment Variables:
```bash
BUNNY_CDN_HOSTNAME=re-podtards-cdn.b-cdn.net
BUNNY_CDN_ZONE=re-podtards
BUNNY_CDN_API_KEY=your-api-key
BUNNY_STORAGE_API_KEY=your-storage-key
BUNNY_STORAGE_ZONE=re-podtards-storage
```

### Debug Commands:
```bash
# Test storage access (should return 401 - requires auth)
curl -I "https://ny.storage.bunnycdn.com/re-podtards-storage/feeds/music-from-the-doerfelverse.xml"

# Test CDN access (should return 200 after Pull Zone setup)
curl -I "https://re-podtards-cdn.b-cdn.net/feeds/music-from-the-doerfelverse.xml"
```

## 🎯 **Expected Result**
After Pull Zone setup:
- ✅ RSS feeds load from CDN (HTTP 200)
- ✅ No more 403 Forbidden errors
- ✅ Faster content loading
- ✅ CDN caching working properly

---
*Last Updated: January 22, 2025*
*Status: ⚠️ Requires Pull Zone Configuration*