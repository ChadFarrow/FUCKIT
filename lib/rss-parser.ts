export interface RSSTrack {
  title: string;
  duration: string;
  url?: string;
  trackNumber?: number;
}

export interface RSSAlbum {
  title: string;
  artist: string;
  description: string;
  coverArt: string | null;
  tracks: RSSTrack[];
  releaseDate: string;
  duration?: string;
  link?: string;
}

export class RSSParser {
  static async parseAlbumFeed(feedUrl: string): Promise<RSSAlbum | null> {
    try {
      // Use a CORS proxy for client-side requests
      const proxyUrl = `/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid XML format');
      }
      
      // Extract channel info
      const channel = xmlDoc.querySelector('channel');
      if (!channel) {
        throw new Error('Invalid RSS feed: no channel found');
      }
      
      const title = channel.querySelector('title')?.textContent?.trim() || 'Unknown Album';
      const description = channel.querySelector('description')?.textContent?.trim() || '';
      const link = channel.querySelector('link')?.textContent?.trim() || '';
      
      // Extract artist from title or author
      let artist = 'Unknown Artist';
      const authorElement = channel.querySelector('itunes\\:author, author');
      if (authorElement) {
        artist = authorElement.textContent?.trim() || artist;
      } else {
        // Try to extract artist from title (format: "Artist - Album")
        const titleParts = title.split(' - ');
        if (titleParts.length > 1) {
          artist = titleParts[0].trim();
        }
      }
      
      // Extract cover art
      let coverArt: string | null = null;
      const imageElement = channel.querySelector('itunes\\:image');
      if (imageElement) {
        coverArt = imageElement.getAttribute('href') || null;
      }
      if (!coverArt) {
        const imageUrl = channel.querySelector('image url');
        if (imageUrl) {
          coverArt = imageUrl.textContent?.trim() || null;
        }
      }
      
      // Extract tracks from items
      const items = xmlDoc.querySelectorAll('item');
      const tracks: RSSTrack[] = [];
      
      items.forEach((item, index) => {
        const trackTitle = item.querySelector('title')?.textContent?.trim() || `Track ${index + 1}`;
        const durationElement = item.querySelector('itunes\\:duration, duration');
        const duration = durationElement?.textContent?.trim() || '0:00';
        const enclosureElement = item.querySelector('enclosure');
        const url = enclosureElement?.getAttribute('url') || undefined;
        
        tracks.push({
          title: trackTitle,
          duration: duration,
          url: url,
          trackNumber: index + 1
        });
      });
      
      // Extract release date
      const pubDateElement = channel.querySelector('pubDate, lastBuildDate');
      const releaseDate = pubDateElement?.textContent?.trim() || new Date().toISOString();
      
      return {
        title,
        artist,
        description,
        coverArt,
        tracks,
        releaseDate,
        link
      };
      
    } catch (error) {
      console.error('Error parsing RSS feed:', error);
      return null;
    }
  }
  
  static async parseMultipleFeeds(feedUrls: string[]): Promise<RSSAlbum[]> {
    const promises = feedUrls.map(url => this.parseAlbumFeed(url));
    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<RSSAlbum> => 
        result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
  }
}