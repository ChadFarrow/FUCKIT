# HGH Tracks Resolution Process

## Current Status

The HGH playlist infrastructure is **complete** and displays all 1119 remote items correctly. However, the tracks show "0 with audio" because we hit Podcast Index API rate limits during resolution.

## What's Working

✅ HGH RSS feed parsing - extracts all 1119 remote items  
✅ Data structure created (matches ITDV format)  
✅ Component renders all tracks correctly  
✅ Empty audio/artwork URL maps ready for population  

## Issue: Rate Limiting

The Podcast Index API returned 429 (Too Many Requests) when trying to resolve 1119 tracks. The API works (confirmed with ITDV feeds) but has strict rate limiting.

## Solution: Gradual Resolution

To populate the audio URLs and make tracks playable:

### Option 1: Wait and Retry (Recommended)
```bash
# Wait 24-48 hours for rate limits to fully reset
# Then run the careful resolution script:
node scripts/resolve-hgh-slowly.js
```

### Option 2: Manual Resolution
If you have access to the actual audio URLs from another source, populate them in:
```
/data/hgh-audio-urls.ts
/data/hgh-artwork-urls.ts
```

### Option 3: Batch Processing
Process tracks in small batches over several days:
```bash
# Process tracks 1-50
node scripts/resolve-hgh-batch.js --start 1 --end 50

# Wait 24 hours, then process 51-100
node scripts/resolve-hgh-batch.js --start 51 --end 100
```

## Files Created

- `hgh-resolved-songs.json` - 1119 track entries with feedGuid/itemGuid pairs
- `hgh-audio-urls.ts` - Empty map ready for audio URLs  
- `hgh-artwork-urls.ts` - Empty map ready for artwork URLs
- `hgh-feed-metadata.json` - RSS feed metadata
- `resolve-hgh-slowly.js` - Rate-limited resolution script
- `debug-podcast-index.js` - API debugging script

## Expected Results

Once resolved, the HGH playlist will show:
- ✅ 1119 tracks with actual song titles and artists
- ✅ Playable audio URLs  
- ✅ Album artwork for each track
- ✅ Proper duration information

This will match the ITDV playlist functionality exactly.

## Rate Limit Recovery

The Podcast Index API typically resets rate limits after 24 hours. Monitor with:
```bash
node scripts/test-api-simple.js
```

When it returns status 200 instead of 429, resolution can proceed.