# Bunny CDN Setup Issue

## Current Problem
The app is trying to load images from Bunny CDN but getting blocked due to wrong content types.

## Root Cause
We have two separate Bunny.net services that aren't connected:

1. **FUCKIT CDN Zone** (`FUCKIT.b-cdn.net`)
   - This is a pull zone CDN
   - Currently serving old cached SVG content with wrong content-type headers
   - Causing "OpaqueResponseBlocking" errors

2. **re-podtards-cache Storage Zone** 
   - This contains the actual image files we uploaded
   - Has 229 proper image files
   - Storage CDN URL would be: `re-podtards-cache.b-cdn.net`
   - Currently returns 403 Forbidden (not publicly accessible)

## Solutions

### Option 1: Enable Public CDN on Storage Zone (Easiest)
1. Log into Bunny.net dashboard
2. Go to Storage Zones → re-podtards-cache
3. Enable "Public CDN Access" 
4. Use `re-podtards-cache.b-cdn.net` as the CDN URL

### Option 2: Configure Pull Zone Correctly
1. Log into Bunny.net dashboard
2. Go to Pull Zones → FUCKIT
3. Change origin URL to: `https://re-podtards-cache.b-cdn.net`
4. Add Storage Zone authentication headers
5. Purge CDN cache to remove old SVG content

### Option 3: Upload Files to FUCKIT Origin
1. Find where FUCKIT pull zone is currently pulling from
2. Upload all image files there
3. Purge CDN cache

## Current Status
- All 229 image files exist in `re-podtards-cache` storage
- App is configured to use CDN URLs
- CDN is serving wrong content causing browser to block images

## Next Steps
1. Access Bunny.net dashboard
2. Either enable public CDN on storage zone (easiest)
3. Or reconfigure pull zone to use storage zone as origin
4. Purge CDN cache after changes