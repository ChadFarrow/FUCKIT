import fs from 'fs';
import path from 'path';

export interface Feed {
  id: string;
  originalUrl: string;
  type: 'album' | 'publisher';
  title: string;
  priority: 'core' | 'extended' | 'low';
  status: 'active' | 'inactive';
  addedAt: string;
  lastUpdated: string;
}

export interface FeedsData {
  feeds: Feed[];
  lastUpdated: string;
  version: number;
}

export class FeedManager {
  private static feedsData: FeedsData | null = null;
  private static readonly feedsPath = path.join(process.cwd(), 'data', 'feeds.json');

  /**
   * Load feeds from data/feeds.json
   */
  static loadFeeds(): FeedsData {
    if (this.feedsData) {
      return this.feedsData;
    }

    try {
      const feedsContent = fs.readFileSync(this.feedsPath, 'utf-8');
      this.feedsData = JSON.parse(feedsContent) as FeedsData;
      return this.feedsData;
    } catch (error) {
      console.error('Failed to load feeds from data/feeds.json:', error);
      // Return empty feeds as fallback
      const fallbackData = {
        feeds: [],
        lastUpdated: new Date().toISOString(),
        version: 1
      };
      this.feedsData = fallbackData;
      return fallbackData;
    }
  }

  /**
   * Get all active feeds
   */
  static getActiveFeeds(): Feed[] {
    const feedsData = this.loadFeeds();
    return feedsData.feeds.filter(feed => feed.status === 'active');
  }

  /**
   * Get feeds by priority
   */
  static getFeedsByPriority(priority: 'core' | 'extended' | 'low'): Feed[] {
    return this.getActiveFeeds().filter(feed => feed.priority === priority);
  }

  /**
   * Get feeds by type
   */
  static getFeedsByType(type: 'album' | 'publisher'): Feed[] {
    return this.getActiveFeeds().filter(feed => feed.type === type);
  }

  /**
   * Get feed URLs in the format expected by the app (for backwards compatibility)
   */
  static getFeedUrlMappings(): [string, string][] {
    const activeFeeds = this.getActiveFeeds();
    return activeFeeds.map(feed => [feed.originalUrl, feed.type]);
  }

  /**
   * Get album feed URLs only
   */
  static getAlbumFeeds(): string[] {
    return this.getFeedsByType('album').map(feed => feed.originalUrl);
  }

  /**
   * Get publisher feed URLs only
   */
  static getPublisherFeeds(): string[] {
    return this.getFeedsByType('publisher').map(feed => feed.originalUrl);
  }

  /**
   * Get core feeds (for immediate loading)
   */
  static getCoreFeeds(): string[] {
    return this.getFeedsByPriority('core').map(feed => feed.originalUrl);
  }

  /**
   * Get extended feeds (for secondary loading)
   */
  static getExtendedFeeds(): string[] {
    return this.getFeedsByPriority('extended').map(feed => feed.originalUrl);
  }

  /**
   * Get low priority feeds (for final loading)
   */
  static getLowPriorityFeeds(): string[] {
    return this.getFeedsByPriority('low').map(feed => feed.originalUrl);
  }

  /**
   * Add a new feed to the feeds.json file
   */
  static addFeed(feed: Omit<Feed, 'addedAt' | 'lastUpdated'>): void {
    const feedsData = this.loadFeeds();
    const newFeed: Feed = {
      ...feed,
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    feedsData.feeds.push(newFeed);
    feedsData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(this.feedsPath, JSON.stringify(feedsData, null, 2));
    this.feedsData = feedsData; // Update cache
  }

  /**
   * Update an existing feed
   */
  static updateFeed(id: string, updates: Partial<Feed>): void {
    const feedsData = this.loadFeeds();
    const feedIndex = feedsData.feeds.findIndex(feed => feed.id === id);
    
    if (feedIndex !== -1) {
      feedsData.feeds[feedIndex] = {
        ...feedsData.feeds[feedIndex],
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      feedsData.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync(this.feedsPath, JSON.stringify(feedsData, null, 2));
      this.feedsData = feedsData; // Update cache
    }
  }

  /**
   * Remove a feed
   */
  static removeFeed(id: string): void {
    const feedsData = this.loadFeeds();
    feedsData.feeds = feedsData.feeds.filter(feed => feed.id !== id);
    feedsData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(this.feedsPath, JSON.stringify(feedsData, null, 2));
    this.feedsData = feedsData; // Update cache
  }
}