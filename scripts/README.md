# FUCKIT Scripts Directory

## Structure

- `tools/` - Consolidated, maintained tools
- `archive/` - Legacy scripts (archived but preserved)  
- `backup/` - Timestamped backups

## Active Tools

### Core RSS Processing
- `parse-all-feeds.js` - Parse all feeds from feeds.json
- `create-playlist-from-rss.js` - Create playlists from RSS feeds
- `parse-single-feed.js` - Parse individual RSS feed

### Consolidated Tools  
- `tools/hgh-resolver.js` - HGH track resolution
- `tools/duration-fixer.js` - Audio duration fixing
- `tools/track-analyzer.js` - Track analysis and reporting
- `tools/title-guid-fixer.js` - Title and GUID corrections

### Working Scripts (Keep As-Is)
- `../quick-duration-fix.js` - Quick duration fixes (current working version)

## Usage

Each consolidated tool has built-in help:
```bash
node scripts/tools/hgh-resolver.js --help
```

## Cleanup History

- **Before cleanup**: 172 JavaScript files
- **After cleanup**: ~11 active scripts
- **Consolidated**: 4 new unified tools
- **Archived**: 48 legacy scripts
- **Backup location**: `scripts/backup/2025-08-09`

Generated: 2025-08-09T23:22:12.871Z
