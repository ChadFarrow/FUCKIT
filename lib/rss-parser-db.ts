import Parser from 'rss-parser';
import { XMLParser } from 'fast-xml-parser';

interface CustomFeed {
  title?: string;
  description?: string;
  link?: string;
  image?: {
    url?: string;
    title?: string;
    link?: string;
  };
  itunes?: {
    author?: string;
    summary?: string;
    image?: { $?: { href?: string } } | { href?: string } | string;
    explicit?: string;
    categories?: Array<{ $?: { text?: string } }> | string[];
    keywords?: string;
  };
  language?: string;
  items?: CustomItem[];
}

interface CustomItem {
  title?: string;
  contentSnippet?: string;
  content?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  link?: string;
  enclosure?: {
    url?: string;
    type?: string;
    length?: string;
  };
  itunes?: {
    author?: string;
    subtitle?: string;
    summary?: string;
    duration?: string;
    explicit?: string;
    keywords?: string;
    image?: string;
    episode?: string;
    season?: string;
  };
  'podcast:chapters'?: any;
  'podcast:value'?: any;
  'podcast:valueTimeSplit'?: any;
}

const parser: Parser<CustomFeed, CustomItem> = new Parser({
  customFields: {
    feed: [
      ['itunes:author', 'itunes.author'],
      ['itunes:summary', 'itunes.summary'],
      ['itunes:image', 'itunes.image'],
      ['itunes:explicit', 'itunes.explicit'],
      ['itunes:category', 'itunes.categories', { keepArray: true }],
      ['itunes:keywords', 'itunes.keywords'],
      'language'
    ],
    item: [
      ['itunes:author', 'itunes.author'],
      ['itunes:subtitle', 'itunes.subtitle'],
      ['itunes:summary', 'itunes.summary'],
      ['itunes:duration', 'itunes.duration'],
      ['itunes:explicit', 'itunes.explicit'],
      ['itunes:keywords', 'itunes.keywords'],
      ['itunes:image', 'itunes.image'],
      ['itunes:episode', 'itunes.episode'],
      ['itunes:season', 'itunes.season'],
      ['podcast:chapters', 'podcast:chapters'],
      ['podcast:value', 'podcast:value'],
      ['podcast:valueTimeSplit', 'podcast:valueTimeSplit']
    ]
  }
});

export interface ParsedFeed {
  title: string;
  description?: string;
  image?: string;
  artist?: string;
  language?: string;
  category?: string;
  explicit: boolean;
  items: ParsedItem[];
}

export interface ParsedItem {
  guid?: string;
  title: string;
  subtitle?: string;
  description?: string;
  artist?: string;
  audioUrl: string;
  duration?: number;
  explicit: boolean;
  image?: string;
  publishedAt?: Date;
  itunesAuthor?: string;
  itunesSummary?: string;
  itunesImage?: string;
  itunesDuration?: string;
  itunesKeywords?: string[];
  itunesCategories?: string[];
  v4vRecipient?: string;
  v4vValue?: any;
  startTime?: number;
  endTime?: number;
}

function extractItunesImage(itunesImage: any): string | undefined {
  if (!itunesImage) return undefined;
  
  if (typeof itunesImage === 'string') {
    return itunesImage;
  }
  
  if (itunesImage.$ && itunesImage.$.href) {
    return itunesImage.$.href;
  }
  
  if (itunesImage.href) {
    return itunesImage.href;
  }
  
  return undefined;
}

function extractItunesCategories(categories: any): string[] {
  if (!categories) return [];
  
  const result: string[] = [];
  
  if (Array.isArray(categories)) {
    categories.forEach(cat => {
      if (typeof cat === 'string') {
        result.push(cat);
      } else if (cat.$ && cat.$.text) {
        result.push(cat.$.text);
      }
    });
  }
  
  return result;
}

function parseDuration(duration: string | undefined): number | undefined {
  if (!duration) return undefined;
  
  // Handle HH:MM:SS format
  if (duration.includes(':')) {
    const parts = duration.split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }
  
  // Handle seconds as string
  const seconds = parseInt(duration, 10);
  return isNaN(seconds) ? undefined : seconds;
}

function parseKeywords(keywords: string | undefined): string[] {
  if (!keywords) return [];
  return keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

export async function parseRSSFeed(feedUrl: string): Promise<ParsedFeed> {
  try {
    // Fetch and parse the feed
    const feed = await parser.parseURL(feedUrl);
    
    // Extract feed-level metadata
    const feedImage = extractItunesImage(feed.itunes?.image) || 
                     feed.image?.url || 
                     undefined;
    
    const feedArtist = feed.itunes?.author || undefined;
    const feedCategories = extractItunesCategories(feed.itunes?.categories);
    const feedExplicit = feed.itunes?.explicit?.toLowerCase() === 'yes' || 
                        feed.itunes?.explicit?.toLowerCase() === 'true';
    
    // Parse items
    const items: ParsedItem[] = [];
    
    if (feed.items) {
      for (const item of feed.items) {
        // Skip items without audio enclosures
        if (!item.enclosure?.url) continue;
        
        const parsedItem: ParsedItem = {
          guid: item.guid || undefined,
          title: item.title || 'Untitled',
          subtitle: item.itunes?.subtitle || undefined,
          description: item.contentSnippet || item.content || undefined,
          artist: item.itunes?.author || feedArtist,
          audioUrl: item.enclosure.url,
          duration: parseDuration(item.itunes?.duration),
          explicit: item.itunes?.explicit?.toLowerCase() === 'yes' || 
                   item.itunes?.explicit?.toLowerCase() === 'true' ||
                   feedExplicit,
          image: extractItunesImage(item.itunes?.image) || feedImage,
          publishedAt: item.isoDate ? new Date(item.isoDate) : 
                      item.pubDate ? new Date(item.pubDate) : undefined,
          itunesAuthor: item.itunes?.author,
          itunesSummary: item.itunes?.summary,
          itunesImage: extractItunesImage(item.itunes?.image),
          itunesDuration: item.itunes?.duration,
          itunesKeywords: parseKeywords(item.itunes?.keywords),
          itunesCategories: feedCategories // Inherit from feed
        };
        
        // Parse V4V (Value for Value) information if present
        if (item['podcast:value']) {
          parsedItem.v4vRecipient = item['podcast:value'].recipient;
          parsedItem.v4vValue = item['podcast:value'];
        }
        
        // Parse time segments if present (for music segments in podcasts)
        if (item['podcast:chapters']) {
          // This would need more complex parsing based on the chapters format
          // For now, we'll leave it as a placeholder
        }
        
        items.push(parsedItem);
      }
    }
    
    return {
      title: feed.title || 'Untitled Feed',
      description: feed.description || feed.itunes?.summary,
      image: feedImage,
      artist: feedArtist,
      language: feed.language,
      category: feedCategories[0], // Take first category as primary
      explicit: feedExplicit,
      items
    };
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
    throw new Error(`Failed to parse RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to parse music segments from podcast RSS feeds
export async function parseMusicSegments(feedUrl: string): Promise<ParsedItem[]> {
  try {
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    
    const response = await fetch(feedUrl);
    const xmlText = await response.text();
    const parsed = xmlParser.parse(xmlText);
    
    const items: ParsedItem[] = [];
    const channel = parsed.rss?.channel || parsed.feed;
    
    if (!channel) {
      throw new Error('Invalid RSS/Atom feed structure');
    }
    
    const feedItems = channel.item || channel.entry || [];
    
    for (const item of Array.isArray(feedItems) ? feedItems : [feedItems]) {
      // Look for remote items (music segments in podcasts)
      if (item['podcast:remoteItem']) {
        const remoteItems = Array.isArray(item['podcast:remoteItem']) 
          ? item['podcast:remoteItem'] 
          : [item['podcast:remoteItem']];
        
        for (const remoteItem of remoteItems) {
          const segment: ParsedItem = {
            guid: remoteItem['@_guid'] || remoteItem.guid,
            title: remoteItem.title || 'Music Segment',
            artist: remoteItem.artist || remoteItem['@_artist'],
            audioUrl: remoteItem['@_enclosureUrl'] || remoteItem.enclosureUrl || item.enclosure?.['@_url'],
            startTime: parseFloat(remoteItem['@_startTime'] || remoteItem.startTime || '0'),
            endTime: remoteItem['@_endTime'] ? parseFloat(remoteItem['@_endTime']) : undefined,
            duration: remoteItem['@_duration'] ? parseFloat(remoteItem['@_duration']) : undefined,
            image: remoteItem['@_image'] || remoteItem.image,
            explicit: false,
            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined
          };
          
          // Parse V4V info if present
          if (remoteItem['podcast:value'] || remoteItem['@_value']) {
            segment.v4vValue = remoteItem['podcast:value'] || remoteItem['@_value'];
          }
          
          items.push(segment);
        }
      }
      
      // Also check for valueTimeSplit which might contain music segments
      if (item['podcast:valueTimeSplit']) {
        const splits = Array.isArray(item['podcast:valueTimeSplit']) 
          ? item['podcast:valueTimeSplit'] 
          : [item['podcast:valueTimeSplit']];
        
        for (const split of splits) {
          if (split['podcast:remoteItem']) {
            const remoteItem = split['podcast:remoteItem'];
            const segment: ParsedItem = {
              guid: remoteItem['@_guid'] || remoteItem.guid,
              title: remoteItem.title || split['@_title'] || 'Music Segment',
              artist: remoteItem.artist || remoteItem['@_artist'],
              audioUrl: item.enclosure?.['@_url'] || item.enclosure?.url,
              startTime: parseFloat(split['@_startTime'] || '0'),
              endTime: split['@_endTime'] ? parseFloat(split['@_endTime']) : undefined,
              duration: split['@_duration'] ? parseFloat(split['@_duration']) : undefined,
              image: remoteItem['@_image'] || remoteItem.image,
              explicit: false,
              publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
              v4vValue: split['podcast:value'] || split['@_value']
            };
            
            items.push(segment);
          }
        }
      }
    }
    
    return items;
  } catch (error) {
    console.error('Error parsing music segments:', error);
    return [];
  }
}

// Combined parser that handles both regular RSS and music segments
export async function parseRSSFeedWithSegments(feedUrl: string): Promise<ParsedFeed> {
  // First try regular RSS parsing
  const feed = await parseRSSFeed(feedUrl);
  
  // Then try to extract any music segments
  const segments = await parseMusicSegments(feedUrl);
  
  // Merge segments into feed items if any were found
  if (segments.length > 0) {
    // Add segments as additional items, avoiding duplicates based on guid
    const existingGuids = new Set(feed.items.map(item => item.guid).filter(Boolean));
    const newSegments = segments.filter(seg => !seg.guid || !existingGuids.has(seg.guid));
    feed.items.push(...newSegments);
  }
  
  return feed;
}