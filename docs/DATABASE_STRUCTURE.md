# Music Database Structure

## Overview
The music database is stored in `data/music-tracks.json` and contains a single root object with a `musicTracks` array.

## Database Schema

```json
{
  "musicTracks": [
    {
      // Track Identifiers
      "id": "track-1",                    // Sequential ID (track-1, track-2, etc.)
      "itemGuid": {                       // RSS item GUID
        "_": "f049d460-6c57-47f9-8ddf-32a32f0011d9",
        "isPermaLink": "false"
      },
      
      // Core Track Information
      "title": "Song Title",              // Track title
      "artist": "Artist Name",            // Primary artist (may be empty)
      "album": "Album Name",              // Album name (defaults to feedTitle if null)
      "albumTitle": "Album Name",         // Duplicate of album field
      "trackNumber": 1,                   // Track position in album
      
      // Feed Information
      "feedGuid": "d3145292-bf71-415f-a841-7f5c9a9466e1",  // Album feed GUID
      "feedUrl": "https://wavlake.com/feed/music/...",     // Album RSS feed URL
      "feedTitle": "Album Name",          // Album title from feed
      "feedDescription": "Album description",               // Album description
      "feedArtist": "",                    // Artist from feed (often empty)
      "feedImage": "https://...jpg",      // Album artwork URL from feed
      
      // Publisher Information (Artist Feed)
      "publisherFeedGuid": "aa909244-7555-4b52-ad88-7233860c6fb4",  // Artist feed GUID (optional)
      "publisherFeedUrl": "https://wavlake.com/feed/artist/...",    // Artist RSS feed URL (optional)
      
      // Media Information
      "enclosureUrl": "https://...mp3",   // Audio file URL (often via OP3 analytics)
      "enclosureType": "audio/mpeg",      // MIME type
      "enclosureLength": "4627367",       // File size in bytes
      "duration": "00:03:45",              // Duration (various formats or empty)
      "image": "https://...jpg",           // Track/album artwork URL
      
      // Metadata
      "published": "Thu, 19 Sep 2024 20:19:01 GMT",  // Publication date
      "addedAt": "2025-08-22T15:00:11.866Z",         // When added to database
      "subtitle": "",                      // Track subtitle (usually empty)
      "summary": "",                       // Track summary (usually empty)
      "explicit": false,                   // Explicit content flag
      "isMusic": true,                     // Music track flag
      "keywords": [],                      // Tag keywords array
      "categories": [                      // Genre categories
        {
          "text": "Pop",
          "category": {
            "text": "Indie Pop"
          }
        }
      ]
    }
  ]
}
```

## Field Details

### Required Fields
- `id` - Unique identifier for the track
- `title` - Track title
- `feedUrl` - Source RSS feed URL
- `enclosureUrl` - Audio file URL
- `addedAt` - Timestamp when track was added

### Optional Fields
- `artist` - May be empty, extracted from various sources
- `publisherFeedGuid` / `publisherFeedUrl` - Only ~75% of tracks have publisher feeds
- `duration` - May be empty or in different formats (seconds, HH:MM:SS)
- `image` / `feedImage` - Album artwork URLs

### Data Statistics (as of last update)
- Total tracks: 964
- Unique albums: 390
- Unique artists: 140
- Tracks with publisher feeds: 729 (75.5%)
- Tracks with images: 964 (100%)
- Tracks with artist names: 836 (86.7%)

## Common Patterns

### Feed URLs
- Wavlake: `https://wavlake.com/feed/music/{guid}`
- RSS Blue: `https://feeds.rssblue.com/{feed-name}`
- Custom feeds: Various personal domains

### Publisher Feed Types
- Wavlake artist feeds: `https://wavlake.com/feed/artist/{guid}`
- Synthetic/placeholder: Not used (removed per requirements)

### Missing Data Handling
- If `album` is null, `feedTitle` is used
- If `artist` is empty, propagated from other tracks in same album
- If no `publisherFeedGuid`, field is left empty (not synthesized)

## Value4Value (V4V) Information
Most tracks include Lightning Network payment information in the original RSS feeds, though this is not currently stored in the database. The `enclosureUrl` often points to OP3 analytics-wrapped URLs that preserve the original audio source.