# Essential Music Database Scripts

This directory contains the core scripts for managing the music database after comprehensive cleanup on 2025-01-26.

## 🎵 Core Music Enhancement Scripts

### 1. Discovery & Import
- **`comprehensive-music-discovery.js`** - Main script for discovering new music feeds using correct Podcast Index API endpoints
- **`add-iam-playlist-tracks.js`** - Import remote items from IAM Music Playlist XML feeds
- **`properly-resolve-iam-tracks.js`** - Resolve imported tracks using correct API endpoints

### 2. Metadata Enhancement  
- **`assign-default-durations.js`** - Assign smart default durations to tracks missing duration data
- **`update-duration-to-9999.js`** - Set placeholder duration to 99:99 for easy identification
- **`update-artwork-to-main-bg.js`** - Use site's main background image for placeholder artwork

### 3. Database Cleanup
- **`remove-placeholder-tracks.js`** - Remove generic/unknown placeholder tracks from database
- **`remove-iam-duplicates.js`** - Deduplicate tracks while preserving best metadata

### 4. Utilities
- **`cleanup-old-scripts.js`** - Archive old/redundant scripts (this cleanup process)

## 🎯 Current Database Status

After running these scripts in sequence, the database achieved:
- **929 tracks** total (cleaned from 958)
- **99.9% duration coverage** (tracks with 99:99 need real metadata)  
- **100% artwork coverage** (placeholders use main page background)
- **93.1% overall completeness** (production-ready)

## 📋 Typical Workflow

1. **Discovery**: Run `comprehensive-music-discovery.js` to find new music feeds
2. **Import**: Use `add-iam-playlist-tracks.js` for playlist imports
3. **Resolve**: Run `properly-resolve-iam-tracks.js` to get metadata
4. **Enhance**: Use duration/artwork scripts for missing metadata
5. **Clean**: Run `remove-placeholder-tracks.js` to remove low-quality entries

## 🎨 Placeholder System

- **Duration: 99:99** = Tracks needing real duration metadata (highly visible)
- **Artwork: `/stablekraft-rocket.png`** = Site's main background for consistent branding

## 🔍 Key Discovery Insight

The major breakthrough was using **music-specific Podcast Index endpoints**:
- `/search/music/byterm` - Search only music-tagged feeds
- `/podcasts/bymedium?medium=music` - Get all music feeds (6,352 available)

This is why services like LNBeats find more music - they use the correct endpoints!

## 📁 Archive

Old scripts have been moved to `archive-cleanup-[timestamp]` directories and can be safely deleted after confirming the cleanup worked correctly.

---

*Generated after comprehensive database enhancement - 2025-01-26*