import fs from 'fs/promises';
import path from 'path';
import { RSSParser } from './rss-parser';
import { BunnyCDN } from './bunny-cdn';

export interface ManagedFeed {
  id: string;
  originalUrl: string;
  cdnUrl?: string;
  type: 'album' | 'publisher';
  title?: string;
  artist?: string;
  status: 'pending' | 'processing' | 'active' | 'error';
  lastFetched?: string;
  lastError?: string;
  albumCount?: number;
  addedAt: string;
  updatedAt: string;
}

export interface FeedDatabase {
  feeds: ManagedFeed[];
  lastUpdated: string | null;
  version: number;
}

const FEEDS_FILE = path.join(process.cwd(), 'data', 'feeds.json');

export class FeedManager {
  private static instance: FeedManager;
  private feeds: Map<string, ManagedFeed> = new Map();
  private lastLoaded: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private bunnyCDN: BunnyCDN;

  constructor() {
    this.bunnyCDN = new BunnyCDN();
  }

  static getInstance(): FeedManager {
    if (!FeedManager.instance) {
      FeedManager.instance = new FeedManager();
    }
    return FeedManager.instance;
  }

  private async ensureDataDir(): Promise<void> {
    const dataDir = path.dirname(FEEDS_FILE);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async loadFeeds(): Promise<void> {
    const now = Date.now();
    if (now - this.lastLoaded < this.CACHE_DURATION && this.feeds.size > 0) {
      return; // Use cached data
    }

    try {
      await this.ensureDataDir();
      const data = await fs.readFile(FEEDS_FILE, 'utf-8');
      const db: FeedDatabase = JSON.parse(data);
      
      this.feeds.clear();
      for (const feed of db.feeds) {
        this.feeds.set(feed.id, feed);
      }
      
      this.lastLoaded = now;
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        // File doesn't exist, start with empty feeds
        this.feeds.clear();
        await this.saveFeeds();
      } else {
        console.error('Error loading feeds:', error);
        throw error;
      }
    }
  }

  private async saveFeeds(): Promise<void> {
    await this.ensureDataDir();
    
    const db: FeedDatabase = {
      feeds: Array.from(this.feeds.values()),
      lastUpdated: new Date().toISOString(),
      version: 1
    };

    await fs.writeFile(FEEDS_FILE, JSON.stringify(db, null, 2));
    this.lastLoaded = Date.now();
  }

  async getAllFeeds(): Promise<ManagedFeed[]> {
    await this.loadFeeds();
    return Array.from(this.feeds.values());
  }

  async getFeed(id: string): Promise<ManagedFeed | null> {
    await this.loadFeeds();
    return this.feeds.get(id) || null;
  }

  async addFeed(url: string, type: 'album' | 'publisher' = 'album'): Promise<ManagedFeed> {
    await this.loadFeeds();

    const id = this.generateFeedId(url);
    
    // Check if feed already exists
    if (this.feeds.has(id)) {
      throw new Error('Feed already exists');
    }

    const feed: ManagedFeed = {
      id,
      originalUrl: url,
      type,
      status: 'pending',
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.feeds.set(id, feed);
    await this.saveFeeds();

    // Process feed asynchronously
    this.processFeed(id).catch(error => {
      console.error(`Error processing feed ${id}:`, error);
    });

    return feed;
  }

  async removeFeed(id: string): Promise<boolean> {
    await this.loadFeeds();
    
    const feed = this.feeds.get(id);
    const existed = this.feeds.delete(id);
    
    if (existed) {
      // Clean up CDN if the feed had a CDN URL
      if (feed?.cdnUrl && this.bunnyCDN.isConfigured()) {
        try {
          const filename = feed.cdnUrl.split('/feeds/')[1];
          if (filename) {
            await this.bunnyCDN.deleteFeed(filename);
            console.log(`🗑️ Cleaned up CDN file for removed feed: ${filename}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to clean up CDN for removed feed ${id}:`, error);
        }
      }
      
      await this.saveFeeds();
    }
    
    return existed;
  }

  async refreshFeed(id: string): Promise<ManagedFeed | null> {
    await this.loadFeeds();
    
    const feed = this.feeds.get(id);
    if (!feed) {
      return null;
    }

    await this.processFeed(id);
    return this.feeds.get(id) || null;
  }

  private async processFeed(id: string): Promise<void> {
    const feed = this.feeds.get(id);
    if (!feed) return;

    try {
      // Update status to processing
      feed.status = 'processing';
      feed.updatedAt = new Date().toISOString();
      await this.saveFeeds();

      // Validate and parse the feed
      const testParse = await RSSParser.parseMultipleFeeds([feed.originalUrl]);
      
      if (testParse && testParse.length > 0) {
        // Extract metadata from first album
        const firstAlbum = testParse[0];
        feed.title = firstAlbum.title;
        feed.artist = firstAlbum.artist;
        feed.albumCount = testParse.length;

        // Upload to Bunny.net CDN if configured
        if (this.bunnyCDN.isConfigured()) {
          try {
            console.log(`🚀 Uploading feed ${id} to CDN...`);
            feed.cdnUrl = await this.bunnyCDN.cacheFeedToCDN(feed.originalUrl, id);
            console.log(`✅ Feed ${id} cached to CDN: ${feed.cdnUrl}`);
          } catch (cdnError) {
            console.warn(`⚠️ Failed to upload feed ${id} to CDN:`, cdnError);
            // Continue without CDN - feed will use original URL
          }
        } else {
          console.log(`ℹ️ Bunny.net CDN not configured, skipping upload for feed ${id}`);
        }

        feed.status = 'active';
        feed.lastFetched = new Date().toISOString();
        feed.lastError = undefined;
      } else {
        throw new Error('No albums found in feed');
      }
    } catch (error) {
      feed.status = 'error';
      feed.lastError = error instanceof Error ? error.message : 'Unknown error';
    }

    feed.updatedAt = new Date().toISOString();
    await this.saveFeeds();
  }

  private generateFeedId(url: string): string {
    // Generate a URL-safe ID from the feed URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace(/[^a-zA-Z0-9-_]/g, '-');
    const timestamp = Date.now().toString(36);
    return `${urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '-')}-${pathname}-${timestamp}`.toLowerCase();
  }

  // Get all active feeds in the format expected by the main app
  async getActiveFeedUrls(): Promise<string[]> {
    await this.loadFeeds();
    return Array.from(this.feeds.values())
      .filter(feed => feed.status === 'active')
      .map(feed => feed.cdnUrl || feed.originalUrl);
  }

  // Get feed mappings in the format expected by the main app
  async getFeedMappings(): Promise<[string, string, string][]> {
    await this.loadFeeds();
    return Array.from(this.feeds.values())
      .filter(feed => feed.status === 'active')
      .map(feed => [
        feed.originalUrl,
        feed.cdnUrl || feed.originalUrl,
        feed.type
      ] as [string, string, string]);
  }

  // Get CDN configuration status for admin interface
  getCDNStatus() {
    return this.bunnyCDN.getStatus();
  }
}