import { RSSParser, RSSAlbum } from './rss-parser';
import { createRSSParser } from '../src/lib/rss-parser-config.js';
import PodcastIndexRSSParser from '../src/lib/rss-feed-parser.js';

/**
 * Enhanced RSS Parser Integration Layer
 * 
 * This module integrates the new feature/rss-feed-parser capabilities
 * into the main application while maintaining backward compatibility
 * with the existing RSS parser.
 */

export interface EnhancedMusicTrack {
  // Legacy fields for compatibility
  title: string;
  subtitle?: string;
  summary?: string;
  itemGuid?: {
    _: string;
    isPermaLink?: string;
  };
  feedGuid: string;
  feedUrl: string;
  feedTitle: string;
  feedDescription: string;
  feedImage?: string;
  feedArtist: string;
  published: string;
  duration: number;
  explicit: boolean;
  keywords: string[];
  
  // Enhanced fields from new parser
  enhancedMetadata?: {
    artist: string;
    albumTitle: string;
    description?: string;
    publishedDate?: string;
    audioUrl?: string;
    audioType?: string;
    audioSize?: string;
    valueForValue?: {
      enabled: boolean;
      configuration?: any;
    };
  };
  
  // Enhancement tracking
  enhancement?: {
    enhanced: boolean;
    enhancedAt?: string;
    enhancements: {
      artistNameImproved: boolean;
      durationResolved: boolean;
      valueForValueAdded: boolean;
      audioUrlAdded: boolean;
    };
  };
}

export interface EnhancedParsingOptions {
  useEnhanced?: boolean;
  includePodcastIndex?: boolean;
  resolveRemoteItems?: boolean;
  extractValueForValue?: boolean;
  timeout?: number;
}

export class EnhancedRSSParser {
  private legacyParser: typeof RSSParser;
  private enhancedParser: PodcastIndexRSSParser | null = null;

  constructor() {
    this.legacyParser = RSSParser;
    this.initializeEnhancedParser();
  }

  private async initializeEnhancedParser() {
    try {
      this.enhancedParser = createRSSParser();
    } catch (error) {
      console.warn('Enhanced RSS parser not available, falling back to legacy parser:', error);
    }
  }

  /**
   * Parse RSS feed with optional enhancement
   */
  async parseAlbumFeed(
    feedUrl: string, 
    options: EnhancedParsingOptions = {}
  ): Promise<RSSAlbum | null> {
    const { 
      useEnhanced = false, 
      includePodcastIndex = false,
      timeout = 30000 
    } = options;

    // Try enhanced parsing first if requested and available
    if (useEnhanced && this.enhancedParser) {
      try {
        const enhancedResult = await this.parseWithEnhancement(feedUrl, options);
        if (enhancedResult) {
          return enhancedResult;
        }
      } catch (error) {
        console.warn('Enhanced parsing failed, falling back to legacy:', error);
      }
    }

    // Fall back to legacy parser
    return await this.legacyParser.parseAlbumFeed(feedUrl);
  }

  /**
   * Parse with the enhanced RSS parser
   */
  private async parseWithEnhancement(
    feedUrl: string,
    options: EnhancedParsingOptions
  ): Promise<RSSAlbum | null> {
    if (!this.enhancedParser) {
      throw new Error('Enhanced parser not initialized');
    }

    try {
      // Use the enhanced parser's fetchAndParseFeed method
      const enhancedData = await this.enhancedParser.fetchAndParseFeed(feedUrl);
      
      // Convert enhanced format to legacy RSSAlbum format
      return this.convertToLegacyFormat(enhancedData, feedUrl);
    } catch (error) {
      console.error('Enhanced parsing error:', error);
      throw error;
    }
  }

  /**
   * Enhance existing music track data using Podcast Index API
   */
  async enhanceMusicTrack(track: any): Promise<EnhancedMusicTrack | null> {
    if (!this.enhancedParser) {
      return this.convertLegacyTrack(track);
    }

    try {
      // Use the enhanced parser to resolve remote item
      const enhancedData = await this.enhancedParser.resolveRemoteItem({
        feedGuid: track.feedGuid,
        itemGuid: track.itemGuid?._
      });

      return this.mergeEnhancedData(track, enhancedData);
    } catch (error) {
      console.warn(`Failed to enhance track "${track.title}":`, error);
      return this.convertLegacyTrack(track);
    }
  }

  /**
   * Batch enhance multiple music tracks
   */
  async enhanceMusicTracks(
    tracks: any[], 
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<EnhancedMusicTrack[]> {
    const { batchSize = 5, delayMs = 1000 } = options;
    const enhancedTracks: EnhancedMusicTrack[] = [];

    // Process in batches to respect API rate limits
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      
      const batchPromises = batch.map(track => this.enhanceMusicTrack(track));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          enhancedTracks.push(result.value);
        }
      });

      // Delay between batches
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return enhancedTracks;
  }

  /**
   * Search music using Podcast Index API
   */
  async searchMusic(query: string, limit: number = 20): Promise<any[]> {
    if (!this.enhancedParser) {
      throw new Error('Enhanced parser required for music search');
    }

    try {
      return await this.enhancedParser.searchMusic(query, limit);
    } catch (error) {
      console.error('Music search failed:', error);
      return [];
    }
  }

  /**
   * Lookup feed by GUID using Podcast Index API
   */
  async lookupByFeedGuid(feedGuid: string): Promise<any | null> {
    if (!this.enhancedParser) {
      throw new Error('Enhanced parser required for GUID lookup');
    }

    try {
      return await this.enhancedParser.lookupByFeedGuid(feedGuid);
    } catch (error) {
      console.error('Feed GUID lookup failed:', error);
      return null;
    }
  }

  /**
   * Convert enhanced parser data to legacy RSSAlbum format
   */
  private convertToLegacyFormat(enhancedData: any, feedUrl: string): RSSAlbum {
    // This would need to be implemented based on the enhanced parser's return format
    // For now, return a basic structure
    return {
      title: enhancedData.feed?.title || 'Unknown Album',
      artist: enhancedData.feed?.itunes?.author || 'Unknown Artist',
      description: enhancedData.feed?.description || '',
      coverArt: enhancedData.feed?.image || null,
      tracks: enhancedData.items?.map((item: any, index: number) => ({
        title: item.title || `Track ${index + 1}`,
        duration: item.itunes?.duration || '0:00',
        url: item.enclosure?.url,
        trackNumber: index + 1,
        subtitle: item.itunes?.subtitle,
        summary: item.contentSnippet || item.content,
        image: item.itunes?.image,
        explicit: item.itunes?.explicit === 'true'
      })) || [],
      releaseDate: enhancedData.feed?.lastBuildDate || new Date().toISOString(),
      link: feedUrl
    };
  }

  /**
   * Merge enhanced data with legacy track data
   */
  private mergeEnhancedData(originalTrack: any, enhancedData: any): EnhancedMusicTrack {
    const track: EnhancedMusicTrack = {
      // Copy all original fields
      ...originalTrack,
      
      // Enhanced metadata
      enhancedMetadata: {
        artist: enhancedData.feed?.itunes?.author || enhancedData.feed?.title || originalTrack.feedArtist,
        albumTitle: enhancedData.feed?.title || originalTrack.feedTitle,
        description: enhancedData.item?.contentSnippet || enhancedData.item?.content || originalTrack.summary,
        publishedDate: enhancedData.item?.pubDate,
        audioUrl: enhancedData.item?.enclosure?.url,
        audioType: enhancedData.item?.enclosure?.type,
        audioSize: enhancedData.item?.enclosure?.length,
        valueForValue: {
          enabled: !!enhancedData.item?.value,
          configuration: enhancedData.item?.value || null
        }
      },
      
      // Enhancement tracking
      enhancement: {
        enhanced: true,
        enhancedAt: new Date().toISOString(),
        enhancements: {
          artistNameImproved: (enhancedData.feed?.itunes?.author || enhancedData.feed?.title) !== originalTrack.feedArtist,
          durationResolved: !!enhancedData.item?.itunes?.duration,
          valueForValueAdded: !!enhancedData.item?.value,
          audioUrlAdded: !!enhancedData.item?.enclosure?.url
        }
      }
    };

    // Update main fields with enhanced data where available
    if (track.enhancedMetadata?.artist && track.enhancedMetadata.artist !== originalTrack.feedArtist) {
      track.feedArtist = track.enhancedMetadata.artist;
    }

    return track;
  }

  /**
   * Convert legacy track to enhanced format without enhancement
   */
  private convertLegacyTrack(track: any): EnhancedMusicTrack {
    return {
      ...track,
      enhancement: {
        enhanced: false,
        enhancements: {
          artistNameImproved: false,
          durationResolved: false,
          valueForValueAdded: false,
          audioUrlAdded: false
        }
      }
    };
  }

  /**
   * Check if enhanced parsing is available
   */
  isEnhancedParsingAvailable(): boolean {
    return this.enhancedParser !== null;
  }

  /**
   * Get enhanced parser capabilities
   */
  getCapabilities(): {
    legacyParsing: boolean;
    enhancedParsing: boolean;
    podcastIndexAPI: boolean;
    valueForValue: boolean;
    remoteItemResolution: boolean;
    musicSearch: boolean;
  } {
    return {
      legacyParsing: true,
      enhancedParsing: this.isEnhancedParsingAvailable(),
      podcastIndexAPI: this.isEnhancedParsingAvailable(),
      valueForValue: this.isEnhancedParsingAvailable(),
      remoteItemResolution: this.isEnhancedParsingAvailable(),
      musicSearch: this.isEnhancedParsingAvailable()
    };
  }
}

// Export singleton instance
export const enhancedRSSParser = new EnhancedRSSParser();

// Export convenience functions
export async function parseAlbumFeedEnhanced(
  feedUrl: string, 
  options?: EnhancedParsingOptions
): Promise<RSSAlbum | null> {
  return enhancedRSSParser.parseAlbumFeed(feedUrl, options);
}

export async function enhanceMusicTrackData(track: any): Promise<EnhancedMusicTrack | null> {
  return enhancedRSSParser.enhanceMusicTrack(track);
}

export async function enhanceMusicTracksData(tracks: any[]): Promise<EnhancedMusicTrack[]> {
  return enhancedRSSParser.enhanceMusicTracks(tracks);
}