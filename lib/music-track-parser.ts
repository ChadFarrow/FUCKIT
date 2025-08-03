import { AppError, ErrorCodes, withRetry, createErrorLogger } from './error-utils';
import * as xml2js from 'xml2js';
import { RSSParser, RSSValueTimeSplit, RSSValueRecipient } from './rss-parser';

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
    tracksFromV4VData: number;
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
        throw new AppError(`Failed to fetch RSS feed: ${response.statusText}`, ErrorCodes.RSS_FETCH_ERROR);
      }
      
      const xmlText = await response.text();
      
      // Parse XML using xml2js
      const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
      const result = await parser.parseStringPromise(xmlText);
      
      if (!result.rss || !result.rss.channel) {
        throw new AppError('Invalid RSS feed structure', ErrorCodes.RSS_PARSE_ERROR);
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
        tracksFromV4VData: tracks.filter(t => t.source === 'value-split' && t.valueForValue?.lightningAddress).length,
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
    
    // Get audio URL from enclosure element
    let audioUrl: string | undefined;
    const enclosure = item.enclosure;
    if (enclosure && enclosure.$ && enclosure.$.url) {
      audioUrl = enclosure.$.url;
    }
    
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
    
    // 2. Extract tracks from value time splits (legacy method)
    const valueSplitTracks = this.extractTracksFromValueSplits(item, {
      episodeId: episodeGuid,
      episodeTitle,
      episodeDate,
      channelTitle,
      feedUrl,
      audioUrl
    });
    tracks.push(...valueSplitTracks);
    
    // 3. Extract tracks from V4V data (enhanced method)
    // First, try to parse the item using RSSParser to get V4V data
    try {
      // Create a mock RSS feed structure for the single item
      const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>${channelTitle}</title>
    <item>
      ${this.itemToXmlString(item)}
    </item>
  </channel>
</rss>`;
      
      // Use RSSParser to parse the V4V data
      const tempFeedUrl = `data:text/xml;base64,${Buffer.from(mockRssXml).toString('base64')}`;
      const parsedAlbum = await RSSParser.parseAlbumFeed(tempFeedUrl);
      
      if (parsedAlbum && parsedAlbum.value4Value) {
        const v4vTracks = this.extractTracksFromV4VData(parsedAlbum.value4Value, {
          episodeId: episodeGuid,
          episodeTitle,
          episodeDate,
          channelTitle,
          feedUrl,
          audioUrl
        });
        tracks.push(...v4vTracks);
      }
    } catch (error) {
      this.logger.warn('Failed to extract V4V data from episode', { 
        episodeId: episodeGuid, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
    
    // 4. Extract tracks from episode description
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
    
    // Use the enhanced V4V parsing from RSSParser
    // Look for podcast:valueTimeSplit elements
    const valueSplits = item['podcast:valueTimeSplit'] || item.valueTimeSplit || [];
    const splitsArray = Array.isArray(valueSplits) ? valueSplits : [valueSplits];
    
    for (const split of splitsArray) {
      if (!split) continue;
      
      const startTime = parseFloat(this.getAttributeValue(split, 'startTime') || '0');
      const endTime = parseFloat(this.getAttributeValue(split, 'endTime') || '0');
      const duration = endTime > startTime ? endTime - startTime : parseFloat(this.getAttributeValue(split, 'duration') || '0');
      
      // Check if this split has remote recipients (indicating music sharing)
      const recipients = split['podcast:valueRecipient'] || split.valueRecipient || [];
      const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];
      
      const hasRemoteRecipients = recipientsArray.some((recipient: any) => {
        if (!recipient) return false;
        const type = this.getAttributeValue(recipient, 'type') || 'remote';
        return type === 'remote' && parseFloat(this.getAttributeValue(recipient, 'percentage') || '0') > 0;
      });
      
      if (startTime > 0 && duration > 0 && hasRemoteRecipients) {
        // Extract recipient information for V4V data
        const primaryRecipient = recipientsArray.find((recipient: any) => {
          if (!recipient) return false;
          const type = this.getAttributeValue(recipient, 'type') || 'remote';
          return type === 'remote';
        });
        
        const lightningAddress = primaryRecipient ? 
          (this.getAttributeValue(primaryRecipient, 'address') || this.getAttributeValue(primaryRecipient, 'lightning') || '') : '';
        
        const suggestedAmount = primaryRecipient ? 
          parseFloat(this.getAttributeValue(primaryRecipient, 'amount') || '0') : 0;
        
        // Try to extract track title from recipient name or custom fields
        let trackTitle = `Music Track at ${this.formatTime(startTime)}`;
        if (primaryRecipient) {
          const recipientName = this.getTextContent(primaryRecipient, 'name') || 
                               this.getAttributeValue(primaryRecipient, 'name') || '';
          if (recipientName && !recipientName.includes('@')) {
            trackTitle = recipientName;
          }
        }
        
        // This is likely a music track shared via value-for-value
        const track: MusicTrack = {
          id: this.generateId(),
          title: trackTitle,
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
            lightningAddress,
            suggestedAmount,
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
   * Extract music tracks from V4V data parsed by RSSParser
   */
  private static extractTracksFromV4VData(
    value4Value: any,
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
    
    if (!value4Value || !value4Value.timeSplits) {
      return tracks;
    }
    
    for (const timeSplit of value4Value.timeSplits) {
      // Check if this time split has remote recipients (indicating music sharing)
      const hasRemoteRecipients = timeSplit.recipients && 
        timeSplit.recipients.some((recipient: RSSValueRecipient) => 
          recipient.type === 'remote' && recipient.percentage > 0
        );
      
      if (hasRemoteRecipients && timeSplit.startTime > 0 && timeSplit.endTime > timeSplit.startTime) {
        // Find the primary remote recipient
        const primaryRecipient = timeSplit.recipients.find((recipient: RSSValueRecipient) => 
          recipient.type === 'remote'
        );
        
        if (primaryRecipient) {
          // Try to extract track title from recipient name
          let trackTitle = `Music Track at ${this.formatTime(timeSplit.startTime)}`;
          if (primaryRecipient.name && !primaryRecipient.name.includes('@')) {
            trackTitle = primaryRecipient.name;
          }
          
          const track: MusicTrack = {
            id: this.generateId(),
            title: trackTitle,
            artist: context.channelTitle,
            episodeId: context.episodeId,
            episodeTitle: context.episodeTitle,
            episodeDate: context.episodeDate,
            startTime: timeSplit.startTime,
            endTime: timeSplit.endTime,
            duration: timeSplit.endTime - timeSplit.startTime,
            audioUrl: context.audioUrl,
            source: 'value-split',
            feedUrl: context.feedUrl,
            discoveredAt: new Date(),
            valueForValue: {
              lightningAddress: primaryRecipient.address || '',
              suggestedAmount: primaryRecipient.amount || 0,
              customKey: primaryRecipient.customKey,
              customValue: primaryRecipient.customValue
            }
          };
          
          tracks.push(track);
        }
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
    
    // Enhanced patterns for extracting songs from episode descriptions
    // Specifically designed for playlist-style feeds like Mike's Mix Tape
    const musicPatterns = [
      // Pattern: "Artist - Song" (most common in playlists)
      /([A-Z][A-Za-z\s&'.-]+)\s*-\s*([A-Z][A-Za-z\s\d\-'",.!?()]+)/g,
      // Pattern: "Artist: Song"
      /([A-Z][A-Za-z\s&'.-]+)\s*:\s*([A-Z][A-Za-z\s\d\-'",.!?()]+)/g,
      // Pattern: "Song by Artist"
      /([A-Z][A-Za-z\s\d\-'",.!?()]+)\s+by\s+([A-Z][A-Za-z\s&'.-]+)/g,
      // Pattern: "Artist 'Song'" or "Artist "Song""
      /([A-Z][A-Za-z\s&'.-]+)\s*['"]([A-Za-z\s\d\-'",.!?()]+)['"]/g,
      // Pattern: "Artist | Song" (common in playlists)
      /([A-Z][A-Za-z\s&'.-]+)\s*\|\s*([A-Z][A-Za-z\s\d\-'",.!?()]+)/g,
      // Legacy patterns for backward compatibility
      /(?:song|track|music|tune):\s*["']([^"']+)["']/gi,
      /["']([^"']+(?:song|track|music|tune)[^"']*)["']/gi,
      /(?:plays?|features?|includes?)\s+["']([^"']+)["']/gi
    ];
    
    // Also look for bullet-point style lists
    const bulletPatterns = [
      /^[\s]*[-•*]\s*([A-Z][A-Za-z\s&'.-]+)\s*[-:]\s*([A-Z][A-Za-z\s\d\-'",.!?()]+)/gm,
      /^[\s]*[-•*]\s*([A-Z][A-Za-z\s&'.-]+)\s*\|\s*([A-Z][A-Za-z\s\d\-'",.!?()]+)/gm
    ];
    
    // Combine all patterns
    const allPatterns = [...musicPatterns, ...bulletPatterns];
    
    for (const pattern of allPatterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        const artist = match[1]?.trim();
        const title = match[2]?.trim();
        
        if (artist && title && artist.length > 2 && title.length > 2) {
          // Skip if it looks like HTML or generic text
          if (artist.includes('<') || title.includes('<') || 
              artist.includes('http') || title.includes('http') ||
              artist.toLowerCase().includes('unknown') ||
              title.toLowerCase().includes('unknown') ||
              artist.toLowerCase().includes('volume') ||
              title.toLowerCase().includes('volume')) {
            continue;
          }
          
          // Skip very short or generic titles
          if (title.length < 3 || artist.length < 3) {
            continue;
          }
          
          const track: MusicTrack = {
            id: this.generateId(),
            title,
            artist,
            episodeId: context.episodeId,
            episodeTitle: context.episodeTitle,
            episodeDate: context.episodeDate,
            startTime: 0,
            endTime: 0,
            duration: 0,
            audioUrl: context.audioUrl,
            source: 'description',
            feedUrl: context.feedUrl,
            discoveredAt: new Date(),
            description: `Extracted from episode description`
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
   * Convert an RSS item object back to XML string for V4V parsing
   */
  private static itemToXmlString(item: any): string {
    let xml = '';
    
    // Add basic item elements
    if (item.title) {
      xml += `<title><![CDATA[${item.title}]]></title>`;
    }
    if (item.description) {
      xml += `<description><![CDATA[${item.description}]]></description>`;
    }
    if (item.guid) {
      xml += `<guid>${item.guid}</guid>`;
    }
    if (item.pubDate) {
      xml += `<pubDate>${item.pubDate}</pubDate>`;
    }
    
    // Add V4V elements
    if (item['podcast:valueTimeSplit']) {
      const splits = Array.isArray(item['podcast:valueTimeSplit']) ? 
        item['podcast:valueTimeSplit'] : [item['podcast:valueTimeSplit']];
      
      splits.forEach((split: any) => {
        if (split && split.$) {
          xml += `<podcast:valueTimeSplit`;
          Object.entries(split.$).forEach(([key, value]) => {
            xml += ` ${key}="${value}"`;
          });
          xml += '>';
          
          if (split['podcast:valueRecipient']) {
            const recipients = Array.isArray(split['podcast:valueRecipient']) ? 
              split['podcast:valueRecipient'] : [split['podcast:valueRecipient']];
            
            recipients.forEach((recipient: any) => {
              if (recipient && recipient.$) {
                xml += `<podcast:valueRecipient`;
                Object.entries(recipient.$).forEach(([key, value]) => {
                  xml += ` ${key}="${value}"`;
                });
                xml += '>';
                if (recipient._) {
                  xml += recipient._;
                }
                xml += '</podcast:valueRecipient>';
              }
            });
          }
          
          xml += '</podcast:valueTimeSplit>';
        }
      });
    }
    
    return xml;
  }

  /**
   * Detect if this is a playlist-style feed where each item is a song
   */
  private static isPlaylistStyleFeed(channel: any): boolean {
    const title = this.getTextContent(channel, 'title') || '';
    const description = this.getTextContent(channel, 'description') || '';
    
    // Check for Podcasting 2.0 musicL medium type
    const isMusicLFeed = channel['podcast:medium'] === 'musicL';
    
    // Check for podcast:remoteItem elements (Podcasting 2.0 playlist feature)
    const hasRemoteItems = channel['podcast:remoteItem'] && channel['podcast:remoteItem'].length > 0;
    
    // Only treat as playlist if it's explicitly musicL or has remote items
    // Regular music podcasts should use normal episode processing
    return isMusicLFeed || hasRemoteItems;
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
      relatedFeeds,
      extractionStats: {
        totalTracks: tracks.length,
        tracksFromChapters: 0,
        tracksFromValueSplits: 0,
        tracksFromV4VData: 0,
        tracksFromDescription: 0,
        relatedFeedsFound: relatedFeeds.length,
        extractionTime
      }
    };
  }

  /**
   * Resolve a remote track by fetching data from the referenced feed
   * This is a placeholder for future enhancement - would require a feed lookup service
   */
  private static async resolveRemoteTrack(
    feedGuid: string, 
    itemGuid: string, 
    playlistTitle: string, 
    playlistFeedUrl: string
  ): Promise<MusicTrack | null> {
    try {
      // TODO: In a full implementation, this would:
      // 1. Use a feed lookup service (like Podcast Index) to find the feed URL from the GUID
      // 2. Fetch the specific item from that feed
      // 3. Extract the actual track metadata
      
      // For now, return null to use the fallback placeholder
      this.logger.info('Remote track resolution not yet implemented', { feedGuid, itemGuid });
      return null;
    } catch (error) {
      this.logger.error('Error resolving remote track', { feedGuid, itemGuid, error });
      return null;
    }
  }
} 