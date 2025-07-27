# Automated Publisher Feed Detection

This system automatically detects and adds publisher feeds when they're discovered in parsed RSS data.

## How It Works

When RSS feeds are parsed, the system looks for `<podcast:remoteItem>` elements with `medium="publisher"` attributes. These indicate that an artist has their own publisher feed containing their full catalog.

### Example Publisher Feed Reference
```xml
<podcast:remoteItem 
  medium="publisher" 
  feedGuid="0ea699be-e985-4aa1-8c00-43542e4b9e0d" 
  feedUrl="https://wavlake.com/feed/artist/0ea699be-e985-4aa1-8c00-43542e4b9e0d">
```

## Automated Process

### 1. Detection
- Scans all parsed feeds for publisher references
- Extracts feed URLs and artist information
- Identifies which publisher feeds are missing from configuration

### 2. Addition
- Automatically adds missing publisher feeds to `data/feeds.json`
- Generates appropriate feed IDs and titles
- Sets priority to "extended" and status to "active"

### 3. Configuration
New publisher feeds are added with this structure:
```json
{
  "id": "artist-name-publisher",
  "originalUrl": "https://wavlake.com/feed/artist/guid",
  "type": "publisher",
  "title": "Artist Name",
  "priority": "extended",
  "status": "active",
  "addedAt": "2025-07-27T02:34:47.000Z",
  "lastUpdated": "2025-07-27T02:34:47.000Z"
}
```

## Usage

### Manual Detection
```bash
npm run auto-add-publishers
```

### Comprehensive Process
```bash
npm run parse-and-add-publishers
```

## Benefits

1. **Automatic Discovery**: No manual intervention needed when new artists are added
2. **Complete Catalogs**: Ensures all artist catalogs are available through publisher feeds
3. **Consistent Structure**: Maintains uniform feed configuration
4. **No Duplicates**: Prevents adding the same publisher feed multiple times

## Current Publisher Feeds

The system currently manages these publisher feeds:
- My Friend Jimi (`0ea699be-e985-4aa1-8c00-43542e4b9e0d`)
- Joe Martin (`18bcbf10-6701-4ffb-b255-bc057390d738`)
- Iroh (`8a9c2e54-785a-4128-9412-737610f5d00a`)
- Wavlake Publisher (`aa909244-7555-4b52-ad88-7233860c6fb4`)

## Integration

This process should be run:
- After any feed parsing operation
- When new RSS feeds are added
- As part of the regular maintenance workflow

The system ensures that whenever a publisher feed is discovered in parsed data, it's automatically added to the configuration for future parsing. 