# Missing Albums Integration Guide

## 🎵 **Overview**

This document outlines the missing albums that need to be added to the Doerfels catalog based on V4V (Value for Value) time splits found in playlist data.

## 📋 **Missing Albums to Add**

### **1. Playlist Track 1**
- **GUID**: `bba99401-378c-5540-bf95-c456b3d4de26`
- **Time Range**: 11:06-14:27 (3 minutes 21 seconds)
- **Current Status**: Placeholder added
- **Action Needed**: Look up in Podcast Index API

### **2. Playlist Track 2**
- **GUID**: `69c634ad-afea-5826-ad9a-8e1f06d6470b`
- **Time Range**: 19:02-23:33 (4 minutes 31 seconds)
- **Current Status**: Placeholder added
- **Action Needed**: Look up in Podcast Index API

### **3. Playlist Track 3**
- **GUID**: `1e7ed1fa-0456-5860-9b34-825d1335d8f8`
- **Time Range**: 55:44-59:30 (3 minutes 46 seconds)
- **Current Status**: Placeholder added
- **Action Needed**: Look up in Podcast Index API

### **4. Playlist Track 4**
- **GUID**: `c76ef0a6-0181-5b9b-a4bc-dd85d4ed178b`
- **Time Range**: 1:04:00-1:07:12 (3 minutes 12 seconds)
- **Current Status**: Placeholder added
- **Action Needed**: Look up in Podcast Index API

## 🔧 **Implementation Steps**

### **Step 1: Look Up Real Album Data**
Run the lookup script when the dev server is running:
```bash
node scripts/lookup-missing-albums.js
```

### **Step 2: Update Doerfels Publisher Feed**
Once you have the real album data, update `app/api/feeds/doerfels-pubfeed/route.ts`:

```javascript
// Replace placeholder entries with real data
{ 
  feedGuid: 'REAL_GUID_HERE', 
  feedUrl: 'REAL_FEED_URL_HERE', 
  title: 'REAL_ALBUM_TITLE_HERE' 
}
```

### **Step 3: Update Album Mapping**
Update the `titleToFeedMap` in `app/album/[id]/AlbumDetailClient.tsx`:

```javascript
'REAL_ALBUM_TITLE': 'REAL_FEED_URL_HERE',
```

### **Step 4: Add to Local Catalog**
If these are Doerfels albums, add them to your local data files:
- `data/parsed-feeds.json`
- `data/music-tracks.json`

### **Step 5: Test Integration**
1. Visit album pages to ensure they load correctly
2. Check that Doerfels publisher information displays
3. Verify related albums show up in the grid

## 🎯 **Current Status**

✅ **Placeholder entries added** to Doerfels publisher feed
✅ **Album mapping updated** with placeholder URLs
✅ **Documentation created** for next steps
⏳ **Real album data lookup** - needs to be completed
⏳ **Integration testing** - needs to be completed

## 📝 **Notes**

- These tracks were found in V4V time splits, indicating they're part of a playlist or compilation
- All tracks are properly indexed in Podcast Index with specific GUIDs
- The 95% remote percentage suggests these are tracks from other artists featured in the playlist
- Once identified, these will help users discover the full playlist content

## 🔍 **V4V Time Split Context**

The original V4V data shows this is a playlist containing:
- 3 tracks from "Stay Awhile" (The Doerfels)
- 1 track from "Pour Over" (The Doerfels)
- 1 track from "Possible" (The Doerfels)
- 4 tracks from other artists (the missing ones above)

This creates a complete playlist experience where users can discover all the music featured in the show. 