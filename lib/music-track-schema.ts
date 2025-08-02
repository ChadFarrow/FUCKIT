/**
 * Music Track Database Schema
 * 
 * This schema defines the data structures for storing extracted music tracks,
 * V4V data, Value Time Splits, and relationships between tracks and episodes.
 * 
 * The schema is designed to work with JSON file storage (similar to the existing
 * feeds.json and parsed-feeds.json structure) while providing comprehensive
 * support for V4V music track extraction features.
 */

// ============================================================================
// CORE MUSIC TRACK INTERFACES
// ============================================================================

export interface MusicTrackRecord {
  id: string;
  title: string;
  artist: string;
  episodeId: string;
  episodeTitle: string;
  episodeDate: Date;
  episodeGuid?: string;
  startTime: number; // seconds
  endTime: number; // seconds
  duration: number; // seconds
  audioUrl?: string;
  image?: string;
  description?: string;
  
  // V4V Data
  valueForValue?: {
    lightningAddress?: string;
    suggestedAmount?: number;
    currency?: string;
    customKey?: string;
    customValue?: string;
    recipientType?: 'remote' | 'local' | 'fee';
    percentage?: number;
  };
  
  // Source information
  source: 'chapter' | 'value-split' | 'description' | 'external-feed' | 'v4v-data';
  feedUrl: string;
  feedId: string;
  
  // Metadata
  discoveredAt: Date;
  lastUpdated: Date;
  extractionMethod: string;
  
  // Relationships
  relatedTracks?: string[]; // IDs of related tracks
  parentTrackId?: string; // For tracks that are part of a larger track
  
  // Tags and categorization
  tags?: string[];
  genre?: string;
  mood?: string;
  
  // Analytics
  playCount?: number;
  lastPlayed?: Date;
  favoriteCount?: number;
}

// ============================================================================
// V4V SPECIFIC INTERFACES
// ============================================================================

export interface ValueTimeSplitRecord {
  id: string;
  episodeId: string;
  episodeGuid?: string;
  startTime: number; // seconds
  endTime: number; // seconds
  duration: number; // seconds
  totalAmount?: number;
  currency?: string;
  
  // Recipients
  recipients: ValueRecipientRecord[];
  
  // Metadata
  feedUrl: string;
  feedId: string;
  discoveredAt: Date;
  lastUpdated: Date;
  
  // Relationships
  musicTracks?: string[]; // IDs of music tracks extracted from this split
}

export interface ValueRecipientRecord {
  id: string;
  valueTimeSplitId: string;
  name: string;
  address?: string; // Lightning address or payment address
  percentage: number;
  amount?: number;
  type: 'remote' | 'local' | 'fee';
  customKey?: string;
  customValue?: string;
  
  // Metadata
  discoveredAt: Date;
  lastUpdated: Date;
}

export interface BoostagramRecord {
  id: string;
  episodeId: string;
  episodeGuid?: string;
  senderName?: string;
  message?: string;
  amount: number;
  currency?: string;
  timestamp?: Date;
  
  // Metadata
  feedUrl: string;
  feedId: string;
  discoveredAt: Date;
  lastUpdated: Date;
}

// ============================================================================
// EPISODE AND FEED INTERFACES
// ============================================================================

export interface EpisodeRecord {
  id: string;
  guid?: string;
  title: string;
  description?: string;
  pubDate: Date;
  duration?: number; // seconds
  audioUrl?: string;
  image?: string;
  
  // Feed information
  feedUrl: string;
  feedId: string;
  feedTitle: string;
  
  // V4V Data
  value4Value?: {
    timeSplits?: string[]; // IDs of ValueTimeSplitRecord
    boostagrams?: string[]; // IDs of BoostagramRecord
    funding?: FundingRecord[];
  };
  
  // Music tracks
  musicTracks?: string[]; // IDs of MusicTrackRecord
  
  // Metadata
  discoveredAt: Date;
  lastUpdated: Date;
  parseStatus: 'pending' | 'success' | 'error';
  parseError?: string;
}

export interface FundingRecord {
  id: string;
  episodeId: string;
  url: string;
  message?: string;
  discoveredAt: Date;
}

export interface MusicFeedRecord {
  id: string;
  title: string;
  description?: string;
  feedUrl: string;
  parentFeedUrl?: string;
  relationship: 'podcast-roll' | 'value-split' | 'related' | 'standalone';
  
  // Content
  episodes?: string[]; // IDs of EpisodeRecord
  musicTracks?: string[]; // IDs of MusicTrackRecord
  
  // Metadata
  discoveredAt: Date;
  lastUpdated: Date;
  lastParsed?: Date;
  parseStatus: 'pending' | 'success' | 'error';
  parseError?: string;
  
  // Statistics
  totalEpisodes?: number;
  totalMusicTracks?: number;
  hasV4VData?: boolean;
  hasValueTimeSplits?: boolean;
}

// ============================================================================
// EXTRACTION AND ANALYTICS INTERFACES
// ============================================================================

export interface MusicTrackExtractionRecord {
  id: string;
  feedUrl: string;
  feedId: string;
  episodeId?: string;
  
  // Extraction results
  musicTracks: string[]; // IDs of MusicTrackRecord
  valueTimeSplits: string[]; // IDs of ValueTimeSplitRecord
  boostagrams: string[]; // IDs of BoostagramRecord
  relatedFeeds: string[]; // IDs of MusicFeedRecord
  
  // Statistics
  extractionStats: {
    totalTracks: number;
    tracksFromChapters: number;
    tracksFromValueSplits: number;
    tracksFromV4VData: number;
    tracksFromDescription: number;
    relatedFeedsFound: number;
    extractionTime: number;
  };
  
  // Metadata
  extractedAt: Date;
  extractionMethod: string;
  extractionVersion: string;
  success: boolean;
  error?: string;
}

export interface MusicTrackAnalytics {
  id: string;
  trackId: string;
  
  // Play metrics
  playCount: number;
  uniqueListeners: number;
  averageListenDuration: number;
  completionRate: number;
  
  // V4V metrics
  totalValueReceived: number;
  valueTransactionCount: number;
  averageValuePerTransaction: number;
  
  // Engagement metrics
  favoriteCount: number;
  shareCount: number;
  commentCount: number;
  
  // Time-based metrics
  firstPlayed?: Date;
  lastPlayed?: Date;
  mostPopularDay?: string;
  mostPopularHour?: number;
  
  // Metadata
  lastUpdated: Date;
}

// ============================================================================
// DATABASE SCHEMA INTERFACE
// ============================================================================

export interface MusicTrackDatabase {
  // Core collections
  musicTracks: MusicTrackRecord[];
  episodes: EpisodeRecord[];
  feeds: MusicFeedRecord[];
  
  // V4V collections
  valueTimeSplits: ValueTimeSplitRecord[];
  valueRecipients: ValueRecipientRecord[];
  boostagrams: BoostagramRecord[];
  funding: FundingRecord[];
  
  // Analytics and extraction
  extractions: MusicTrackExtractionRecord[];
  analytics: MusicTrackAnalytics[];
  
  // Metadata
  metadata: {
    version: string;
    lastUpdated: Date;
    totalTracks: number;
    totalEpisodes: number;
    totalFeeds: number;
    totalExtractions: number;
  };
}

// ============================================================================
// UTILITY TYPES AND HELPERS
// ============================================================================

export type MusicTrackSource = 'chapter' | 'value-split' | 'description' | 'external-feed' | 'v4v-data';
export type ValueRecipientType = 'remote' | 'local' | 'fee';
export type FeedRelationship = 'podcast-roll' | 'value-split' | 'related' | 'standalone';
export type ParseStatus = 'pending' | 'success' | 'error';

export interface MusicTrackSearchFilters {
  artist?: string;
  title?: string;
  feedId?: string;
  episodeId?: string;
  source?: MusicTrackSource;
  hasV4VData?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  durationRange?: {
    min: number;
    max: number;
  };
  tags?: string[];
}

export interface MusicTrackSearchResult {
  tracks: MusicTrackRecord[];
  total: number;
  page: number;
  pageSize: number;
  filters: MusicTrackSearchFilters;
}

// ============================================================================
// SCHEMA VALIDATION
// ============================================================================

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMusicTrackRecord(track: MusicTrackRecord): SchemaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!track.id) errors.push('Missing required field: id');
  if (!track.title) errors.push('Missing required field: title');
  if (!track.artist) errors.push('Missing required field: artist');
  if (!track.episodeId) errors.push('Missing required field: episodeId');
  if (!track.episodeTitle) errors.push('Missing required field: episodeTitle');
  if (!track.feedUrl) errors.push('Missing required field: feedUrl');
  if (!track.feedId) errors.push('Missing required field: feedId');
  
  // Time validation
  if (track.startTime < 0) errors.push('startTime cannot be negative');
  if (track.endTime < 0) errors.push('endTime cannot be negative');
  if (track.duration < 0) errors.push('duration cannot be negative');
  if (track.endTime <= track.startTime) errors.push('endTime must be greater than startTime');
  
  // V4V validation
  if (track.valueForValue) {
    if (track.valueForValue.suggestedAmount && track.valueForValue.suggestedAmount < 0) {
      errors.push('suggestedAmount cannot be negative');
    }
    if (track.valueForValue.percentage && (track.valueForValue.percentage < 0 || track.valueForValue.percentage > 100)) {
      errors.push('percentage must be between 0 and 100');
    }
  }
  
  // Warnings
  if (!track.discoveredAt) warnings.push('Missing discoveredAt timestamp');
  if (!track.lastUpdated) warnings.push('Missing lastUpdated timestamp');
  if (track.duration === 0) warnings.push('Duration is 0 - may indicate extraction issue');
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// SCHEMA MIGRATION HELPERS
// ============================================================================

export interface SchemaMigration {
  version: string;
  description: string;
  migrate: (data: any) => any;
}

export const SCHEMA_VERSION = '1.0.0';

export function createEmptyDatabase(): MusicTrackDatabase {
  return {
    musicTracks: [],
    episodes: [],
    feeds: [],
    valueTimeSplits: [],
    valueRecipients: [],
    boostagrams: [],
    funding: [],
    extractions: [],
    analytics: [],
    metadata: {
      version: SCHEMA_VERSION,
      lastUpdated: new Date(),
      totalTracks: 0,
      totalEpisodes: 0,
      totalFeeds: 0,
      totalExtractions: 0
    }
  };
} 