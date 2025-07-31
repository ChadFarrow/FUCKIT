/**
 * Centralized data service to simplify feed and album matching logic
 * This prevents recurring issues with complex data relationships
 */

import { RSSAlbum, RSSPublisherItem } from './rss-parser';
import { monitoring, monitorApiResponse } from './monitoring';

interface FeedData {
  id: string;
  originalUrl: string;
  type: 'album' | 'publisher';
  parseStatus: string;
  parsedData?: {
    album?: RSSAlbum;
    publisherInfo?: any;
    publisherItems?: any[];
    remoteItems?: any[];
  };
  metadata?: {
    totalItems?: number;
    validItems?: number;
    emptyTitleItems?: number;
    validationIssues?: string[];
  };
}

interface PublisherData {
  publisherInfo: any;
  albums: RSSAlbum[];
  publisherItems: any[];
  feedId: string;
}

class DataService {
  private feedsCache: FeedData[] | null = null;
  private albumsCache: RSSAlbum[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Get all feeds with caching
   */
  async getFeeds(): Promise<FeedData[]> {
    if (this.feedsCache && Date.now() < this.cacheExpiry) {
      return this.feedsCache;
    }

    try {
      // Check if we're running on the server side
      if (typeof window === 'undefined') {
        // Server-side: read directly from file
        const fs = require('fs');
        const path = require('path');
        const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
        
        if (!fs.existsSync(parsedFeedsPath)) {
          throw new Error('Parsed feeds data not found');
        }

        const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        this.feedsCache = data.feeds || [];
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
        
        monitoring.info('data-service', `Loaded ${this.feedsCache?.length || 0} feeds from file system`);
        return this.feedsCache || [];
      } else {
        // Client-side: fetch from API
        const response = await fetch('/api/parsed-feeds');
        const data = await response.json();
        
        // Monitor API response
        monitorApiResponse('/api/parsed-feeds', response, data);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch feeds: ${response.status}`);
        }

        this.feedsCache = data.feeds || [];
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
        
        monitoring.info('data-service', `Loaded ${this.feedsCache?.length || 0} feeds from API`);
        return this.feedsCache || [];
      }
    } catch (error) {
      monitoring.error('data-service', 'Failed to fetch feeds', { error: (error as Error).message });
      return this.feedsCache || [];
    }
  }

  /**
   * Get all albums with caching
   */
  async getAlbums(): Promise<RSSAlbum[]> {
    if (this.albumsCache && Date.now() < this.cacheExpiry) {
      return this.albumsCache;
    }

    try {
      const response = await fetch('/api/albums');
      const data = await response.json();
      
      // Monitor API response  
      monitorApiResponse('/api/albums', response, data);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch albums: ${response.status}`);
      }

      this.albumsCache = data.albums || [];
      
      monitoring.info('data-service', `Loaded ${this.albumsCache?.length || 0} albums from API`);
      return this.albumsCache || [];
    } catch (error) {
      monitoring.error('data-service', 'Failed to fetch albums', { error: (error as Error).message });
      return this.albumsCache || [];
    }
  }

  /**
   * Find albums by feedGuids - simplified matching logic
   */
  async findAlbumsByFeedGuids(feedGuids: string[]): Promise<RSSAlbum[]> {
    const feeds = await this.getFeeds();
    const matchedAlbums: RSSAlbum[] = [];

    monitoring.info('data-service', `Finding albums for ${feedGuids.length} feedGuids`);

    for (const feedGuid of feedGuids) {
      // Try exact matches first
      const exactMatch = feeds.find(feed => 
        feed.id === feedGuid && 
        feed.parseStatus === 'success' && 
        feed.parsedData?.album
      );

      if (exactMatch?.parsedData?.album) {
        matchedAlbums.push(exactMatch.parsedData.album);
        monitoring.info('data-service', `Exact match found: ${exactMatch.parsedData.album.title}`);
        continue;
      }

      // Try partial matches
      const partialMatch = feeds.find(feed => 
        (feed.id.includes(feedGuid) || feedGuid.includes(feed.id)) &&
        feed.parseStatus === 'success' && 
        feed.parsedData?.album
      );

      if (partialMatch?.parsedData?.album) {
        matchedAlbums.push(partialMatch.parsedData.album);
        monitoring.info('data-service', `Partial match found: ${partialMatch.parsedData.album.title}`);
        continue;
      }

      // If no match found by feedGuid, try to find the corresponding feed by URL
      // This is needed for publisher feeds where remoteItems have feedGuid but feeds have different IDs
      const publisherFeeds = feeds.filter(feed => 
        feed.type === 'publisher' && 
        feed.parseStatus === 'success' &&
        (feed.parsedData?.remoteItems || feed.parsedData?.publisherInfo?.remoteItems)
      );

      for (const publisherFeed of publisherFeeds) {
        // Get remoteItems from either location
        const remoteItems = publisherFeed.parsedData?.remoteItems || publisherFeed.parsedData?.publisherInfo?.remoteItems || [];
        
        // Find the remoteItem that matches this feedGuid
        const remoteItem = remoteItems.find((item: any) => 
          item.feedGuid === feedGuid
        );

        if (remoteItem?.feedUrl) {
          // Find the feed that matches this URL
          const urlMatch = feeds.find(feed => 
            feed.originalUrl === remoteItem.feedUrl &&
            feed.parseStatus === 'success' && 
            feed.parsedData?.album
          );

          if (urlMatch?.parsedData?.album) {
            matchedAlbums.push(urlMatch.parsedData.album);
            monitoring.info('data-service', `URL match found: ${urlMatch.parsedData.album.title}`);
            break; // Found a match, no need to check other publisher feeds
          }
        }
      }

      monitoring.warn('data-service', `No match found for feedGuid: ${feedGuid}`);
    }

    return matchedAlbums;
  }

  /**
   * Get publisher data by publisher ID - simplified logic
   */
  async getPublisherData(publisherId: string): Promise<PublisherData | null> {
    const feeds = await this.getFeeds();
    
    console.log(`🏢 Looking for publisher: ${publisherId}`);

    // Find publisher feed
    const publisherFeed = feeds.find(feed => {
      if (feed.type !== 'publisher' || feed.parseStatus !== 'success') {
        return false;
      }

      // Multiple matching strategies
      const idMatch = feed.id.includes(publisherId) || publisherId.includes(feed.id);
      const urlMatch = feed.originalUrl.includes(publisherId);
      const artistMatch = feed.parsedData?.publisherInfo?.artist?.toLowerCase().includes(publisherId.toLowerCase());

      return idMatch || urlMatch || artistMatch;
    });

    if (!publisherFeed) {
      console.log(`❌ Publisher feed not found: ${publisherId}`);
      return null;
    }

    console.log(`✅ Found publisher feed: ${publisherFeed.id}`);

    const publisherInfo = publisherFeed.parsedData?.publisherInfo || {};
    const publisherItems = publisherFeed.parsedData?.publisherItems || publisherFeed.parsedData?.remoteItems || [];

    // Get albums for this publisher
    let albums: RSSAlbum[] = [];

    if (publisherItems.length > 0) {
      // Extract feedGuids from publisher items
      const feedGuids = publisherItems
        .map((item: any) => item.feedGuid)
        .filter((guid: string) => guid && guid.trim() !== '');

      if (feedGuids.length > 0) {
        albums = await this.findAlbumsByFeedGuids(feedGuids);
      }
    }

    // If no albums found via feedGuids, try artist matching
    if (albums.length === 0 && publisherInfo.artist) {
      console.log(`🎭 Trying artist-based matching: ${publisherInfo.artist}`);
      const allAlbums = await this.getAlbums();
      albums = allAlbums.filter(album => 
        album.artist && 
        album.artist.toLowerCase().includes(publisherInfo.artist.toLowerCase())
      );
      console.log(`🎵 Found ${albums.length} albums by artist matching`);
    }

    return {
      publisherInfo,
      albums,
      publisherItems,
      feedId: publisherFeed.id
    };
  }

  /**
   * Get validation report for debugging
   */
  async getValidationReport(): Promise<any> {
    const feeds = await this.getFeeds();
    const albums = await this.getAlbums();

    const publisherFeeds = feeds.filter(f => f.type === 'publisher');
    const albumFeeds = feeds.filter(f => f.type === 'album');

    const publisherIssues = publisherFeeds.filter(f => 
      f.metadata?.validationIssues && f.metadata.validationIssues.length > 0
    );

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalFeeds: feeds.length,
        publisherFeeds: publisherFeeds.length,
        albumFeeds: albumFeeds.length,
        totalAlbums: albums.length,
        publisherFeedsWithIssues: publisherIssues.length
      },
      issues: {
        publisherFeeds: publisherIssues.map(f => ({
          id: f.id,
          url: f.originalUrl,
          issues: f.metadata?.validationIssues,
          emptyTitleItems: f.metadata?.emptyTitleItems,
          totalItems: f.metadata?.totalItems
        }))
      }
    };
  }

  /**
   * Clear cache to force refresh
   */
  clearCache(): void {
    this.feedsCache = null;
    this.albumsCache = null;
    this.cacheExpiry = 0;
    console.log('🗑️ Data service cache cleared');
  }
}

// Export singleton instance
export const dataService = new DataService();
export default dataService;