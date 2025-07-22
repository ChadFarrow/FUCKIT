export interface RSSTrack {
  title: string;
  duration: string;
  url?: string;
  trackNumber?: number;
  subtitle?: string;
  summary?: string;
  image?: string;
  explicit?: boolean;
  keywords?: string[];
}

export interface RSSFunding {
  url: string;
  message?: string;
}

export interface RSSPodRoll {
  url: string;
  title?: string;
  description?: string;
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
  funding?: RSSFunding[];
  subtitle?: string;
  summary?: string;
  keywords?: string[];
  categories?: string[];
  explicit?: boolean;
  language?: string;
  copyright?: string;
  owner?: {
    name?: string;
    email?: string;
  };
  podroll?: RSSPodRoll[];
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
      
      // Helper function to clean HTML content
      const cleanHtmlContent = (content: string | null | undefined): string | undefined => {
        if (!content) return undefined;
        // Remove HTML tags and decode HTML entities
        return content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
          .replace(/&amp;/g, '&') // Replace &amp; with &
          .replace(/&lt;/g, '<') // Replace &lt; with <
          .replace(/&gt;/g, '>') // Replace &gt; with >
          .replace(/&quot;/g, '"') // Replace &quot; with "
          .replace(/&#39;/g, "'") // Replace &#39; with '
          .trim();
      };
      
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
      
      // Extract additional channel metadata
      const subtitle = channel.getElementsByTagName('itunes:subtitle')[0]?.textContent?.trim();
      const summary = channel.getElementsByTagName('itunes:summary')[0]?.textContent?.trim();
      const languageEl = channel.querySelector('language');
      const language = languageEl?.textContent?.trim();
      const copyrightEl = channel.querySelector('copyright');
      const copyright = copyrightEl?.textContent?.trim();
      
      // Extract explicit rating
      const explicitEl = channel.getElementsByTagName('itunes:explicit')[0];
      const explicit = explicitEl?.textContent?.trim().toLowerCase() === 'true';
      
      // Extract keywords
      const keywordsEl = channel.getElementsByTagName('itunes:keywords')[0];
      const keywords = keywordsEl?.textContent?.trim().split(',').map(k => k.trim()).filter(k => k) || [];
      
      // Extract categories
      const categoryElements = channel.getElementsByTagName('itunes:category');
      const categories = Array.from(categoryElements).map(cat => cat.getAttribute('text')).filter(Boolean) as string[];
      
      // Extract owner info
      const ownerEl = channel.getElementsByTagName('itunes:owner')[0];
      const owner = ownerEl ? {
        name: ownerEl.getElementsByTagName('itunes:name')[0]?.textContent?.trim(),
        email: ownerEl.getElementsByTagName('itunes:email')[0]?.textContent?.trim()
      } : undefined;

      // Extract tracks from items
      const items = xmlDoc.querySelectorAll('item');
      const tracks: RSSTrack[] = [];
      
      items.forEach((item, index) => {
        const trackTitle = item.querySelector('title')?.textContent?.trim() || `Track ${index + 1}`;
        const durationElement = item.querySelector('itunes\\:duration, duration');
        const duration = durationElement?.textContent?.trim() || '0:00';
        const enclosureElement = item.querySelector('enclosure');
        const url = enclosureElement?.getAttribute('url') || undefined;
        
        // Extract track-specific metadata
        const trackSubtitle = item.getElementsByTagName('itunes:subtitle')[0]?.textContent?.trim();
        const trackSummary = item.getElementsByTagName('itunes:summary')[0]?.textContent?.trim();
        
        // Helper function to clean HTML content
        const cleanHtmlContent = (content: string | null | undefined): string | undefined => {
          if (!content) return undefined;
          // Remove HTML tags and decode HTML entities
          return content
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
            .replace(/&amp;/g, '&') // Replace &amp; with &
            .replace(/&lt;/g, '<') // Replace &lt; with <
            .replace(/&gt;/g, '>') // Replace &gt; with >
            .replace(/&quot;/g, '"') // Replace &quot; with "
            .replace(/&#39;/g, "'") // Replace &#39; with '
            .trim();
        };
        const trackImageEl = item.getElementsByTagName('itunes:image')[0];
        const trackImage = trackImageEl?.getAttribute('href') || trackImageEl?.getAttribute('url');
        const trackExplicitEl = item.getElementsByTagName('itunes:explicit')[0];
        const trackExplicit = trackExplicitEl?.textContent?.trim().toLowerCase() === 'true';
        const trackKeywordsEl = item.getElementsByTagName('itunes:keywords')[0];
        const trackKeywords = trackKeywordsEl?.textContent?.trim().split(',').map(k => k.trim()).filter(k => k) || [];
        
        tracks.push({
          title: trackTitle,
          duration: duration,
          url: url,
          trackNumber: index + 1,
          subtitle: cleanHtmlContent(trackSubtitle),
          summary: cleanHtmlContent(trackSummary),
          image: trackImage || undefined,
          explicit: trackExplicit,
          keywords: trackKeywords.length > 0 ? trackKeywords : undefined
        });
      });
      
      // Extract release date
      const pubDateElement = channel.querySelector('pubDate, lastBuildDate');
      const releaseDate = pubDateElement?.textContent?.trim() || new Date().toISOString();
      
      // Extract funding information
      const fundingElements = channel.querySelectorAll('podcast\\:funding, funding');
      const funding: RSSFunding[] = [];
      
      fundingElements.forEach(fundingElement => {
        const url = fundingElement.getAttribute('url') || fundingElement.textContent?.trim();
        const message = fundingElement.textContent?.trim() || fundingElement.getAttribute('message');
        
        if (url) {
          funding.push({
            url: url,
            message: message || undefined
          });
        }
      });
      
      // Extract PodRoll information  
      const podrollElements = channel.querySelectorAll('podcast\\\\:podroll, podroll');
      const podroll: RSSPodRoll[] = [];
      
      podrollElements.forEach(podrollElement => {
        const url = podrollElement.getAttribute('url');
        const title = podrollElement.getAttribute('title') || podrollElement.textContent?.trim();
        const description = podrollElement.getAttribute('description');
        
        if (url) {
          podroll.push({
            url: url,
            title: title || undefined,
            description: description || undefined
          });
        }
      });
      
      console.log('🎲 Found PodRoll entries:', podroll);
      
      return {
        title,
        artist,
        description: cleanHtmlContent(description) || '',
        coverArt,
        tracks,
        releaseDate,
        link,
        funding: funding.length > 0 ? funding : undefined,
        subtitle: cleanHtmlContent(subtitle),
        summary: cleanHtmlContent(summary),
        keywords: keywords.length > 0 ? keywords : undefined,
        categories: categories.length > 0 ? categories : undefined,
        explicit,
        language,
        copyright,
        owner: owner && (owner.name || owner.email) ? owner : undefined,
        podroll: podroll.length > 0 ? podroll : undefined
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