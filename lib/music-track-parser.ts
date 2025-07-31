import { AppError, ErrorCodes, withRetry, createErrorLogger } from './error-utils';
import * as xml2js from 'xml2js';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  episodeId: string;
  episodeTitle: string;
  episodeDate: Date; // Publication date of the episode
  startTime: number; // seconds
  endTime: number; // seconds
  duration: number; // seconds
  audioUrl?: string;
  valueForValue?: {
    lightningAddress: string;
    suggestedAmount: number;
    customKey?: string;
    customValue?: string;
  };
  source: 'chapter' | 'value-split' | 'description' | 'external-feed';
  feedUrl: string;
  discoveredAt: Date;
  description?: string;
  image?: string;
}

export interface MusicFeed {
  id: string;
  title: string;
  description: string;
  feedUrl: string;
  parentFeedUrl?: string;
  relationship: 'podcast-roll' | 'value-split' | 'related';
  tracks: MusicTrack[];
  lastUpdated: Date;
}

export interface ChapterData {
  version: string;
  chapters: Array<{
    title: string;
    startTime: number;
    endTime?: number;
    url?: string;
    image?: string;
  }>;
}

export interface ValueTimeSplit {
  startTime: number;
  duration: number;
  remotePercentage: number;
  remoteItem?: {
    feedGuid: string;
    itemGuid: string;
  };
}

export interface MusicTrackExtractionResult {
  tracks: MusicTrack[];
  relatedFeeds: MusicFeed[];
  extractionStats: {
    totalTracks: number;
    tracksFromChapters: number;
    tracksFromValueSplits: number;
    tracksFromDescription: number;
    relatedFeedsFound: number;
    extractionTime: number;
  };
}

export class MusicTrackParser {
  private static readonly logger = createErrorLogger('MusicTrackParser');

  /**
   * Extract music tracks from a podcast RSS feed
   */
  static async extractMusicTracks(feedUrl: string): Promise<MusicTrackExtractionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting music track extraction', { feedUrl });
      
      // Fetch and parse the RSS feed
      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new AppError(`Failed to fetch RSS feed: ${response.statusText}`, ErrorCodes.FETCH_ERROR);
      }
      
      const xmlText = await response.text();
      
      // Parse XML using xml2js
      const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
      const result = await parser.parseStringPromise(xmlText);
      
      if (!result.rss || !result.rss.channel) {
        throw new AppError('Invalid RSS feed structure', ErrorCodes.PARSE_ERROR);
      }
      
      // Check if this is a playlist-style feed (each item is a song)
      const isPlaylistFeed = this.isPlaylistStyleFeed(result.rss.channel);
      
      if (isPlaylistFeed) {
        return this.extractTracksFromPlaylistFeed(result.rss.channel, feedUrl, startTime);
      }
      
      const tracks: MusicTrack[] = [];
      const relatedFeeds: MusicFeed[] = [];
      
      // Extract channel information
      const channel = result.rss.channel;
      const channelTitle = this.getTextContent(channel, 'title') || 'Unknown Podcast';
      const channelDescription = this.getTextContent(channel, 'description') || '';
      
      // Parse podcast roll for related music feeds
      const podRollFeeds = await this.parsePodcastRoll(channel, feedUrl);
      relatedFeeds.push(...podRollFeeds);
      
      // Parse each item (episode)
      const items = Array.isArray(channel.item) ? channel.item : [channel.item];
      for (const item of items) {
        if (item) {
          const episodeTracks = await this.extractTracksFromEpisode(item, channelTitle, feedUrl);
          tracks.push(...episodeTracks);
        }
      }
      
      const extractionTime = Date.now() - startTime;
      
      const stats = {
        totalTracks: tracks.length,
        tracksFromChapters: tracks.filter(t => t.source === 'chapter').length,
        tracksFromValueSplits: tracks.filter(t => t.source === 'value-split').length,
        tracksFromDescription: tracks.filter(t => t.source === 'description').length,
        relatedFeedsFound: relatedFeeds.length,
        extractionTime
      };
      
      this.logger.info('Music track extraction completed', { 
        feedUrl, 
        stats 
      });
      
      return {
        tracks,
        relatedFeeds,
        extractionStats: stats
      };
      
    } catch (error) {
      this.logger.error('Music track extraction failed', { feedUrl, error });
      throw error;
    }
  }

  /**
   * Extract music tracks from a single episode
   */
  private static async extractTracksFromEpisode(
    item: any, 
    channelTitle: string, 
    feedUrl: string
  ): Promise<MusicTrack[]> {
    const tracks: MusicTrack[] = [];
    
    const episodeTitle = this.getTextContent(item, 'title') || 'Unknown Episode';
    const episodeGuid = this.getTextContent(item, 'guid') || this.generateId();
    const episodeDescription = this.getTextContent(item, 'description') || '';
    const audioUrl = this.getAttributeValue(item, 'enclosure', 'url');
    
    // Extract episode publication date
    const pubDateStr = this.getTextContent(item, 'pubDate');
    const episodeDate = pubDateStr ? new Date(pubDateStr) : new Date();
    
    // 1. Extract tracks from chapter data
    const chapterTracks = await this.extractTracksFromChapters(item, {
      episodeId: episodeGuid,
      episodeTitle,
      episodeDate,
      channelTitle,
      feedUrl,
      audioUrl
    });
    tracks.push(...chapterTracks);
    
    // 2. Extract tracks from value time splits
    const valueSplitTracks = this.extractTracksFromValueSplits(item, {
      episodeId: episodeGuid,
      episodeTitle,
      episodeDate,
      channelTitle,
      feedUrl,
      audioUrl
    });
    tracks.push(...valueSplitTracks);
    
    // 3. Extract tracks from episode description
    const descriptionTracks = this.extractTracksFromDescription(episodeDescription, {
      episodeId: episodeGuid,
      episodeTitle,
      episodeDate,
      channelTitle,
      feedUrl,
      audioUrl
    });
    tracks.push(...descriptionTracks);
    
    return tracks;
  }

  /**
   * Extract music tracks from chapter JSON files
   */
  private static async extractTracksFromChapters(
    item: any, 
    context: {
      episodeId: string;
      episodeTitle: string;
      episodeDate: Date;
      channelTitle: string;
      feedUrl: string;
      audioUrl?: string;
    }
  ): Promise<MusicTrack[]> {
    const tracks: MusicTrack[] = [];
    
    // Look for podcast:chapters element
    const chaptersElement = item['podcast:chapters'] || item.chapters;
    if (!chaptersElement) return tracks;
    
    const chaptersUrl = this.getAttributeValue(chaptersElement, 'url');
    if (!chaptersUrl) return tracks;
    
    try {
      // Fetch and parse the chapters JSON file
      const response = await fetch(chaptersUrl);
      if (!response.ok) {
        this.logger.warn('Failed to fetch chapters file', { url: chaptersUrl });
        return tracks;
      }
      
      const chaptersData: ChapterData = await response.json();
      
      // Extract music tracks from chapters
      for (const chapter of chaptersData.chapters) {
        // Check if this chapter represents a music track
        if (this.isMusicChapter(chapter)) {
          const { artist, title } = this.extractArtistAndTitle(chapter.title);
          
          const track: MusicTrack = {
            id: this.generateId(),
            title: title,
            artist: artist,
            episodeId: context.episodeId,
            episodeTitle: context.episodeTitle,
            episodeDate: context.episodeDate,
            startTime: chapter.startTime,
            endTime: chapter.endTime || chapter.startTime + 300, // Default 5 minutes if no end time
            duration: (chapter.endTime || chapter.startTime + 300) - chapter.startTime,
            audioUrl: context.audioUrl,
            source: 'chapter',
            feedUrl: context.feedUrl,
            discoveredAt: new Date(),
            image: chapter.image
          };
          
          tracks.push(track);
        }
      }
      
    } catch (error) {
      this.logger.warn('Failed to parse chapters file', { url: chaptersUrl, error });
    }
    
    return tracks;
  }

  /**
   * Extract music tracks from value time splits
   */
  private static extractTracksFromValueSplits(
    item: any,
    context: {
      episodeId: string;
      episodeTitle: string;
      episodeDate: Date;
      channelTitle: string;
      feedUrl: string;
      audioUrl?: string;
    }
  ): MusicTrack[] {
    const tracks: MusicTrack[] = [];
    
    // Look for podcast:valueTimeSplit elements
    const valueSplits = item['podcast:valueTimeSplit'] || item.valueTimeSplit || [];
    const splitsArray = Array.isArray(valueSplits) ? valueSplits : [valueSplits];
    
    for (const split of splitsArray) {
      if (!split) continue;
      
      const startTime = parseFloat(this.getAttributeValue(split, 'startTime') || '0');
      const duration = parseFloat(this.getAttributeValue(split, 'duration') || '0');
      const remotePercentage = parseFloat(this.getAttributeValue(split, 'remotePercentage') || '0');
      
      if (startTime > 0 && duration > 0 && remotePercentage > 0) {
        // This is likely a music track shared via value-for-value
        const track: MusicTrack = {
          id: this.generateId(),
          title: `Music Track at ${this.formatTime(startTime)}`,
          artist: context.channelTitle,
          episodeId: context.episodeId,
          episodeTitle: context.episodeTitle,
          episodeDate: context.episodeDate,
          startTime,
          endTime: startTime + duration,
          duration,
          audioUrl: context.audioUrl,
          source: 'value-split',
          feedUrl: context.feedUrl,
          discoveredAt: new Date(),
          valueForValue: {
            lightningAddress: '', // Would need to extract from value recipients
            suggestedAmount: 0,
            customKey: this.getAttributeValue(split, 'customKey'),
            customValue: this.getAttributeValue(split, 'customValue')
          }
        };
        
        tracks.push(track);
      }
    }
    
    return tracks;
  }

  /**
   * Extract music tracks from episode description
   */
  private static extractTracksFromDescription(
    description: string,
    context: {
      episodeId: string;
      episodeTitle: string;
      episodeDate: Date;
      channelTitle: string;
      feedUrl: string;
      audioUrl?: string;
    }
  ): MusicTrack[] {
    const tracks: MusicTrack[] = [];
    
    // Simple pattern matching for music track mentions
    // This is a basic implementation - could be enhanced with NLP
    const musicPatterns = [
      /(?:song|track|music|tune):\s*["']([^"']+)["']/gi,
      /["']([^"']+(?:song|track|music|tune)[^"']*)["']/gi,
      /(?:plays?|features?|includes?)\s+["']([^"']+)["']/gi
    ];
    
    for (const pattern of musicPatterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        const trackString = match[1].trim();
        if (trackString.length > 3) { // Filter out very short matches
          const { artist, title } = this.extractArtistAndTitle(trackString);
          
          const track: MusicTrack = {
            id: this.generateId(),
            title: title,
            artist: artist,
            episodeId: context.episodeId,
            episodeTitle: context.episodeTitle,
            episodeDate: context.episodeDate,
            startTime: 0, // Unknown timestamp
            endTime: 0,
            duration: 0,
            audioUrl: context.audioUrl,
            source: 'description',
            feedUrl: context.feedUrl,
            discoveredAt: new Date(),
            description: `Extracted from episode description: "${trackString}"`
          };
          
          tracks.push(track);
        }
      }
    }
    
    return tracks;
  }

  /**
   * Parse podcast roll for related music feeds
   */
  private static async parsePodcastRoll(
    channel: any, 
    parentFeedUrl: string
  ): Promise<MusicFeed[]> {
    const feeds: MusicFeed[] = [];
    
    const podRoll = channel['podcast:podroll'] || channel.podroll;
    if (!podRoll) return feeds;
    
    const podRollItems = podRoll['podcast:remoteItem'] || podRoll.remoteItem || [];
    const itemsArray = Array.isArray(podRollItems) ? podRollItems : [podRollItems];
    
    for (const item of itemsArray) {
      if (!item) continue;
      
      const feedGuid = this.getAttributeValue(item, 'feedGuid');
      const feedUrl = this.getAttributeValue(item, 'feedUrl');
      
      if (feedUrl) {
        try {
          // Try to fetch basic info about the related feed
          const feedInfo = await this.getFeedBasicInfo(feedUrl);
          
          const feed: MusicFeed = {
            id: feedGuid || this.generateId(),
            title: feedInfo.title || 'Unknown Feed',
            description: feedInfo.description || '',
            feedUrl,
            parentFeedUrl,
            relationship: 'podcast-roll',
            tracks: [],
            lastUpdated: new Date()
          };
          
          feeds.push(feed);
          
        } catch (error) {
          this.logger.warn('Failed to get info for related feed', { feedUrl, error });
        }
      }
    }
    
    return feeds;
  }

  /**
   * Get basic information about a feed without full parsing
   */
  private static async getFeedBasicInfo(feedUrl: string): Promise<{ title?: string; description?: string }> {
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) return {};
      
      const xmlText = await response.text();
      const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
      const result = await parser.parseStringPromise(xmlText);
      
      if (!result.rss || !result.rss.channel) return {};
      
      const channel = result.rss.channel;
      return {
        title: this.getTextContent(channel, 'title'),
        description: this.getTextContent(channel, 'description')
      };
      
    } catch (error) {
      this.logger.warn('Failed to get basic feed info', { feedUrl, error });
      return {};
    }
  }

  /**
   * Check if a chapter represents a music track
   */
  private static isMusicChapter(chapter: { title: string; startTime: number }): boolean {
    const title = chapter.title.toLowerCase();
    
    // Keywords that suggest music content
    const musicKeywords = [
      'song', 'track', 'music', 'tune', 'melody', 'jam', 'riff',
      'instrumental', 'acoustic', 'electric', 'guitar', 'piano',
      'drums', 'bass', 'vocal', 'chorus', 'verse', 'bridge'
    ];
    
    return musicKeywords.some(keyword => title.includes(keyword));
  }

  /**
   * Extract artist and title from a track string
   * Common patterns: "Artist - Title", "Artist: Title", "Artist \"Title\"", etc.
   */
  private static extractArtistAndTitle(trackString: string): { artist: string; title: string } {
    const trimmed = trackString.trim();
    
    // Pattern 1: "Artist - Title"
    const dashMatch = trimmed.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      return {
        artist: dashMatch[1].trim(),
        title: dashMatch[2].trim()
      };
    }
    
    // Pattern 2: "Artist: Title"
    const colonMatch = trimmed.match(/^(.+?):\s*(.+)$/);
    if (colonMatch) {
      return {
        artist: colonMatch[1].trim(),
        title: colonMatch[2].trim()
      };
    }
    
    // Pattern 3: "Artist \"Title\""
    const quoteMatch = trimmed.match(/^(.+?)\s*"([^"]+)"$/);
    if (quoteMatch) {
      return {
        artist: quoteMatch[1].trim(),
        title: quoteMatch[2].trim()
      };
    }
    
    // Pattern 4: "Artist 'Title'"
    const singleQuoteMatch = trimmed.match(/^(.+?)\s*'([^']+)'$/);
    if (singleQuoteMatch) {
      return {
        artist: singleQuoteMatch[1].trim(),
        title: singleQuoteMatch[2].trim()
      };
    }
    
    // Pattern 5: "Artist (Title)"
    const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      return {
        artist: parenMatch[1].trim(),
        title: parenMatch[2].trim()
      };
    }
    
    // If no pattern matches, assume the whole string is the title
    return {
      artist: 'Unknown Artist',
      title: trimmed
    };
  }

  /**
   * Utility methods
   */
  private static getTextContent(element: any, tagName: string): string | undefined {
    const value = element[tagName];
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object' && value._) return value._.trim();
    return undefined;
  }

  private static getAttributeValue(element: any, attribute: string): string | undefined {
    if (!element || typeof element !== 'object') return undefined;
    
    // Check if it's a string (direct value)
    if (typeof element === 'string') return element;
    
    // Check if it has the attribute directly
    if (element.$ && element.$[attribute]) return element.$[attribute];
    
    // Check if the element itself has the attribute
    if (element[attribute]) return element[attribute];
    
    return undefined;
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private static formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Detect if this is a playlist-style feed where each item is a song
   */
  private static isPlaylistStyleFeed(channel: any): boolean {
    const title = this.getTextContent(channel, 'title') || '';
    const description = this.getTextContent(channel, 'description') || '';
    
    // Check for Podcasting 2.0 musicL medium type
    const isMusicLFeed = channel['podcast:medium'] === 'musicL';
    
    // Check for playlist indicators in title or description
    const playlistKeywords = ['playlist', 'songs', 'tracks', 'music', 'lightning thrashes'];
    const hasPlaylistKeywords = playlistKeywords.some(keyword => 
      title.toLowerCase().includes(keyword) || description.toLowerCase().includes(keyword)
    );
    
    // Check for podcast:remoteItem elements (Podcasting 2.0 playlist feature)
    const hasRemoteItems = channel['podcast:remoteItem'] && channel['podcast:remoteItem'].length > 0;
    
    // Check if items have music-related titles
    const items = channel.item || [];
    if (items.length > 0) {
      const firstItem = Array.isArray(items) ? items[0] : items;
      const itemTitle = this.getTextContent(firstItem, 'title') || '';
      
      // If item titles look like song titles (not episode titles), it's likely a playlist
      const songTitlePatterns = [
        /^[A-Z][a-z]+ [A-Z][a-z]+/, // "Artist Song" pattern
        /^[A-Z][a-z]+ - [A-Z][a-z]+/, // "Artist - Song" pattern
        /^[A-Z][a-z]+: [A-Z][a-z]+/, // "Artist: Song" pattern
      ];
      
      const looksLikeSongTitle = songTitlePatterns.some(pattern => pattern.test(itemTitle));
      
      return isMusicLFeed || hasPlaylistKeywords || looksLikeSongTitle || hasRemoteItems;
    }
    
    return isMusicLFeed || hasPlaylistKeywords || hasRemoteItems;
  }

  /**
   * Extract tracks from a playlist-style feed where each item is a song
   */
  private static async extractTracksFromPlaylistFeed(
    channel: any, 
    feedUrl: string, 
    startTime: number
  ): Promise<MusicTrackExtractionResult> {
    const tracks: MusicTrack[] = [];
    const channelTitle = this.getTextContent(channel, 'title') || 'Unknown Playlist';
    const isMusicLFeed = channel['podcast:medium'] === 'musicL';
    
    // Handle podcast:remoteItem elements (Podcasting 2.0 playlist feature)
    const remoteItems = channel['podcast:remoteItem'] || [];
    const remoteItemArray = Array.isArray(remoteItems) ? remoteItems : [remoteItems];
    
    // Track related feeds for future enhancement
    const relatedFeeds: MusicFeed[] = [];
    const feedGuids = new Set<string>();
    
    for (const remoteItem of remoteItemArray) {
      if (remoteItem && remoteItem.$) {
        const feedGuid = remoteItem.$.feedGuid;
        const itemGuid = remoteItem.$.itemGuid;
        
        // Track unique feed GUIDs
        feedGuids.add(feedGuid);
        
        // Try to resolve the actual track data from the referenced feed
        const resolvedTrack = await this.resolveRemoteTrack(feedGuid, itemGuid, channelTitle, feedUrl);
        
        if (resolvedTrack) {
          tracks.push(resolvedTrack);
        } else {
          // Fallback to placeholder if resolution fails
          const trackTitle = isMusicLFeed 
            ? `Music Track (${feedGuid.substring(0, 8)}...)`
            : `Track from ${feedGuid}`;
          const artist = isMusicLFeed ? 'From MusicL Feed' : 'Various Artists';
          
          const track: MusicTrack = {
            id: this.generateId(),
            title: trackTitle,
            artist,
            episodeId: itemGuid,
            episodeTitle: channelTitle,
            episodeDate: new Date(),
            startTime: 0,
            endTime: 0,
            duration: 0,
            source: 'external-feed',
            feedUrl,
            discoveredAt: new Date(),
            description: `Podcasting 2.0 musicL track from feed ${feedGuid}`
          };
          
          tracks.push(track);
        }
      }
    }
    
    // Handle regular items if they exist (for non-remoteItem musicL feeds)
    const items = channel.item || [];
    const itemArray = Array.isArray(items) ? items : [items];
    
    for (const item of itemArray) {
      const itemTitle = this.getTextContent(item, 'title') || '';
      const itemDescription = this.getTextContent(item, 'description') || '';
      const pubDate = this.getTextContent(item, 'pubDate');
      const guid = this.getTextContent(item, 'guid') || this.generateId();
      
      // Extract artist and title from the item title
      const { artist, title } = this.extractArtistAndTitle(itemTitle);
      
      // Get audio URL from enclosure
      const enclosure = item.enclosure;
      let audioUrl: string | undefined;
      if (enclosure && enclosure.$ && enclosure.$.url) {
        audioUrl = enclosure.$.url;
      }
      
      // For musicL feeds, also check for podcast:value elements (Value for Value)
      let valueForValue;
      if (isMusicLFeed && item['podcast:value']) {
        const valueElement = item['podcast:value'];
        if (valueElement && valueElement['podcast:valueRecipient']) {
          const recipients = Array.isArray(valueElement['podcast:valueRecipient']) 
            ? valueElement['podcast:valueRecipient'] 
            : [valueElement['podcast:valueRecipient']];
          
          // Find the first recipient (usually the artist)
          const firstRecipient = recipients[0];
          if (firstRecipient && firstRecipient.$) {
            valueForValue = {
              lightningAddress: firstRecipient.$.name || '',
              suggestedAmount: parseFloat(valueElement.$.suggested || '0'),
              customKey: firstRecipient.$.customKey,
              customValue: firstRecipient.$.customValue
            };
          }
        }
      }
      
      // Create a music track from this playlist item
      const track: MusicTrack = {
        id: this.generateId(),
        title: title || itemTitle,
        artist: artist || channelTitle,
        episodeId: guid,
        episodeTitle: channelTitle,
        episodeDate: pubDate ? new Date(pubDate) : new Date(),
        startTime: 0,
        endTime: 0,
        duration: 0,
        audioUrl,
        valueForValue,
        source: isMusicLFeed ? 'external-feed' : 'external-feed',
        feedUrl,
        discoveredAt: new Date(),
        description: itemDescription
      };
      
      tracks.push(track);
    }
    
    const extractionTime = Date.now() - startTime;
    
    return {
      tracks,
      relatedFeeds: [],
      extractionStats: {
        totalTracks: tracks.length,
        tracksFromChapters: 0,
        tracksFromValueSplits: 0,
        tracksFromDescription: 0,
        relatedFeedsFound: 0,
        extractionTime
      }
    };
  }
} 