import { logger } from './logger';
import { withRetry, createNetworkError, createTimeoutError } from './error-utils';

export interface FeedItem {
  id: string;
  title: string;
  artist?: string;
  description?: string;
  coverArt?: string;
  tracks: Track[];
  publisher?: string;
  podroll?: any[];
  funding?: any[];
  feedId: string;
  feedUrl: string;
  lastUpdated: string;
}

export interface Track {
  title: string;
  duration: number;
  url: string;
  trackNumber?: number;
  subtitle?: string;
  summary?: string;
  image?: string;
  explicit?: boolean;
  keywords?: string[];
}

export interface ParseOptions {
  timeout?: number;
  maxRetries?: number;
  cache?: boolean;
  validate?: boolean;
}

export interface ParseResult {
  success: boolean;
  data?: FeedItem[];
  error?: string;
  duration: number;
  feedCount: number;
  albumCount: number;
  trackCount: number;
}

export class FeedParser {
  private cache = new Map<string, { data: FeedItem[]; timestamp: number; ttl: number }>();
  private log = logger.component('FeedParser');
  
  constructor(
    private defaultTimeout: number = 30000,
    private defaultMaxRetries: number = 3,
    private defaultCacheTtl: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  async parseFeed(url: string, options: ParseOptions = {}): Promise<FeedItem[]> {
    const startTime = Date.now();
    const cacheKey = `feed:${url}`;
    
    const {
      timeout = this.defaultTimeout,
      maxRetries = this.defaultMaxRetries,
      cache = true,
      validate = true
    } = options;

    try {
      // Check cache first
      if (cache) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
          this.log.debug(`Cache hit for feed: ${url}`);
          return cached.data;
        }
      }

      this.log.debug(`Parsing feed: ${url}`);
      
      const feedData = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RSS-Parser/1.0)'
              }
            });
            
            clearTimeout(timeoutId);
            
                         if (!response.ok) {
               throw createNetworkError(`HTTP ${response.status}: ${response.statusText}`);
             }
            
            const text = await response.text();
            return this.parseRSSContent(text, url);
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        },
        {
          maxRetries,
          context: `parseFeed:${url}`
        }
      );

      // Validate if requested
      if (validate) {
        this.validateFeedData(feedData);
      }

      // Cache the result
      if (cache) {
        this.cache.set(cacheKey, {
          data: feedData,
          timestamp: Date.now(),
          ttl: this.defaultCacheTtl
        });
      }

      const duration = Date.now() - startTime;
      this.log.info(`Feed parsed successfully: ${url}`, {
        duration: `${duration}ms`,
        albumCount: feedData.length,
        trackCount: feedData.reduce((sum, album) => sum + album.tracks.length, 0)
      });

      return feedData;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log.error(`Failed to parse feed: ${url}`, error);
      throw error;
    }
  }

  async parseBatch(urls: string[], options: ParseOptions & { concurrency?: number } = {}): Promise<ParseResult> {
    const startTime = Date.now();
    const { concurrency = 3, ...parseOptions } = options;
    
    this.log.info(`Starting batch parse of ${urls.length} feeds`, { concurrency });
    
    const results: FeedItem[][] = [];
    const errors: string[] = [];
    
    // Process feeds in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchPromises = batch.map(async (url) => {
        try {
          return await this.parseFeed(url, parseOptions);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${url}: ${errorMessage}`);
          return [];
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    // Flatten results
    const allAlbums = results.flat();
    const totalTracks = allAlbums.reduce((sum, album) => sum + album.tracks.length, 0);
    
    const duration = Date.now() - startTime;
    const result: ParseResult = {
      success: errors.length === 0,
      data: allAlbums,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      duration,
      feedCount: urls.length,
      albumCount: allAlbums.length,
      trackCount: totalTracks
    };
    
    this.log.info(`Batch parse completed`, {
      duration: `${duration}ms`,
      success: result.success,
      feedCount: result.feedCount,
      albumCount: result.albumCount,
      trackCount: result.trackCount,
      errorCount: errors.length
    });
    
    return result;
  }

  private parseRSSContent(content: string, feedUrl: string): FeedItem[] {
    try {
      // Basic RSS parsing - this is a simplified version
      // In a real implementation, you'd use a proper RSS parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      
      if (doc.querySelector('parsererror')) {
        throw new Error('Invalid XML/RSS format');
      }
      
      const items = doc.querySelectorAll('item');
      const albums: FeedItem[] = [];
      
      items.forEach((item, index) => {
        const album: FeedItem = {
          id: `${feedUrl}-${index}`,
                     title: item.querySelector('title')?.textContent || 'Unknown Album',
           artist: item.querySelector('itunes\\:author')?.textContent || 
                   item.querySelector('author')?.textContent || undefined,
           description: item.querySelector('description')?.textContent || 
                       item.querySelector('itunes\\:summary')?.textContent || undefined,
                     coverArt: item.querySelector('itunes\\:image')?.getAttribute('href') ||
                    item.querySelector('image')?.getAttribute('href') || undefined,
          tracks: [{
            title: item.querySelector('title')?.textContent || 'Unknown Track',
            duration: this.parseDuration(item.querySelector('itunes\\:duration')?.textContent),
            url: item.querySelector('enclosure')?.getAttribute('url') || '',
            trackNumber: index + 1
          }],
          feedId: this.generateFeedId(feedUrl),
          feedUrl,
          lastUpdated: item.querySelector('pubDate')?.textContent || new Date().toISOString()
        };
        
        albums.push(album);
      });
      
      return albums;
      
    } catch (error) {
             this.log.error('RSS parsing failed', error);
      throw new Error(`Failed to parse RSS content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateFeedData(feedData: FeedItem[]): void {
    const errors: string[] = [];
    
    feedData.forEach((album, index) => {
      if (!album.title) {
        errors.push(`Album ${index}: Missing title`);
      }
      if (!album.tracks || album.tracks.length === 0) {
        errors.push(`Album ${index}: No tracks found`);
      }
      album.tracks.forEach((track, trackIndex) => {
        if (!track.title) {
          errors.push(`Album ${index}, Track ${trackIndex}: Missing title`);
        }
        if (!track.url) {
          errors.push(`Album ${index}, Track ${trackIndex}: Missing URL`);
        }
      });
    });
    
    if (errors.length > 0) {
      this.log.warn('Feed validation warnings', { errors });
    }
  }

  private parseDuration(durationStr?: string | null): number {
    if (!durationStr) return 0;
    
    // Handle various duration formats: "3:45", "03:45", "225", "3:45:30"
    const parts = durationStr.split(':').map(Number);
    
    if (parts.length === 1) {
      return parts[0]; // Seconds only
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    }
    
    return 0;
  }

  private generateFeedId(feedUrl: string): string {
    // Generate a simple hash-based ID
    let hash = 0;
    for (let i = 0; i < feedUrl.length; i++) {
      const char = feedUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
    this.log.info('Cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  removeFromCache(url: string): boolean {
    const cacheKey = `feed:${url}`;
    return this.cache.delete(cacheKey);
  }
} 