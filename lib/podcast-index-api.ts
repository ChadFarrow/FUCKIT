import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface PodcastIndexFeed {
  id: number;
  title: string;
  url: string;
  originalUrl: string;
  link: string;
  description: string;
  author: string;
  ownerName: string;
  image: string;
  artwork: string;
  lastUpdateTime: number;
  lastCrawlTime: number;
  lastParseTime: number;
  lastGoodHttpStatusTime: number;
  lastHttpStatus: number;
  contentType: string;
  itunesId?: number;
  language: string;
  explicit: boolean;
  type: number;
  medium: string;
  dead: number;
  chash: string;
  episodeCount: number;
  crawlErrors: number;
  parseErrors: number;
  categories: { [key: string]: string };
  locked: number;
  imageUrlHash: number;
  value: any;
}

interface PodcastIndexEpisode {
  id: number;
  title: string;
  link: string;
  description: string;
  guid: string;
  datePublished: number;
  datePublishedPretty: string;
  dateCrawled: number;
  enclosureUrl: string;
  enclosureType: string;
  enclosureLength: number;
  duration: number;
  explicit: number;
  episode?: number;
  episodeType: string;
  season?: number;
  image: string;
  feedItunesId?: number;
  feedImage: string;
  feedId: number;
  feedTitle: string;
  feedLanguage: string;
  chaptersUrl?: string;
  transcriptUrl?: string;
  value?: any;
  soundbite?: any;
  soundbites?: any[];
}

class PodcastIndexAPI {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.podcastindex.org/api/1.0';

  constructor() {
    // Load environment variables from .env.local if not already loaded
    if (!process.env.PODCAST_INDEX_API_KEY) {
      this.loadEnvFile();
    }
    
    this.apiKey = process.env.PODCAST_INDEX_API_KEY || '';
    this.apiSecret = process.env.PODCAST_INDEX_API_SECRET || '';
    
    if (!this.apiKey || !this.apiSecret) {
      console.warn('Podcast Index API credentials not found in environment variables');
      console.warn('API Key exists:', !!this.apiKey);
      console.warn('API Secret exists:', !!this.apiSecret);
    } else {
      console.log('✅ Podcast Index API credentials loaded successfully');
    }
  }

  private loadEnvFile() {
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
          const [key, value] = line.split('=');
          if (key && value && !process.env[key]) {
            process.env[key] = value;
          }
        });
        console.log('📁 Loaded environment variables from .env.local');
      }
    } catch (error) {
      console.warn('Failed to load .env.local file:', error);
    }
  }

  private getAuthHeaders(): { [key: string]: string } {
    const apiHeaderTime = Math.floor(Date.now() / 1000).toString();
    const hash = crypto
      .createHash('sha1')
      .update(this.apiKey + this.apiSecret + apiHeaderTime)
      .digest('hex');

    return {
      'X-Auth-Date': apiHeaderTime,
      'X-Auth-Key': this.apiKey,
      'Authorization': hash,
      'User-Agent': 'StableKraft/1.0'
    };
  }

  async getFeedByGuid(guid: string): Promise<PodcastIndexFeed | null> {
    try {
      const url = `${this.baseUrl}/podcasts/byguid?guid=${encodeURIComponent(guid)}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        console.error(`Podcast Index API error for feed ${guid}: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (data.status === 'true' && data.feed) {
        return data.feed as PodcastIndexFeed;
      }
      
      console.warn(`No feed found for GUID: ${guid}`);
      return null;
    } catch (error) {
      console.error(`Error fetching feed by GUID ${guid}:`, error);
      return null;
    }
  }

  async getEpisodeByGuid(feedGuid: string, episodeGuid: string): Promise<PodcastIndexEpisode | null> {
    try {
      // First get the feed to get the feed ID
      const feed = await this.getFeedByGuid(feedGuid);
      if (!feed) {
        return null;
      }

      const url = `${this.baseUrl}/episodes/byguid?guid=${encodeURIComponent(episodeGuid)}&feedid=${feed.id}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        console.error(`Podcast Index API error for episode ${episodeGuid}: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (data.status === 'true' && data.episode) {
        return data.episode as PodcastIndexEpisode;
      }
      
      console.warn(`No episode found for GUID: ${episodeGuid} in feed: ${feedGuid}`);
      return null;
    } catch (error) {
      console.error(`Error fetching episode by GUID ${episodeGuid}:`, error);
      return null;
    }
  }

  async resolveArtworkForTrack(feedGuid: string, itemGuid?: string): Promise<string | null> {
    try {
      // First try to get episode-specific artwork if itemGuid is provided
      if (itemGuid) {
        const episode = await this.getEpisodeByGuid(feedGuid, itemGuid);
        if (episode?.image && episode.image.trim() !== '') {
          console.log(`✅ Found episode artwork for ${itemGuid}: ${episode.image}`);
          return episode.image;
        }
      }

      // Fall back to feed artwork
      const feed = await this.getFeedByGuid(feedGuid);
      if (feed) {
        const artwork = feed.artwork || feed.image;
        if (artwork && artwork.trim() !== '') {
          console.log(`✅ Found feed artwork for ${feedGuid}: ${artwork}`);
          return artwork;
        }
      }

      console.warn(`❌ No artwork found for feed ${feedGuid}, item ${itemGuid}`);
      return null;
    } catch (error) {
      console.error(`Error resolving artwork for ${feedGuid}/${itemGuid}:`, error);
      return null;
    }
  }
}

// Create a singleton instance
export const podcastIndexAPI = new PodcastIndexAPI();

// Cache for resolved artwork to avoid repeated API calls
const artworkCache = new Map<string, string | null>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const cacheTimestamps = new Map<string, number>();

export async function resolveArtworkFromPodcastIndex(
  feedGuid: string, 
  itemGuid?: string
): Promise<string | null> {
  const cacheKey = `${feedGuid}:${itemGuid || 'feed'}`;
  
  // Check cache first
  if (artworkCache.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey) || 0;
    if (Date.now() - timestamp < CACHE_DURATION) {
      return artworkCache.get(cacheKey) || null;
    }
  }

  // Resolve from API
  const artwork = await podcastIndexAPI.resolveArtworkForTrack(feedGuid, itemGuid);
  
  // Cache the result
  artworkCache.set(cacheKey, artwork);
  cacheTimestamps.set(cacheKey, Date.now());
  
  return artwork;
}