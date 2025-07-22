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
      // Try direct fetch first (RSS feed has CORS headers), fallback to proxy
      let response;
      try {
        response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'DoerfelVerse/1.0 (Music RSS Reader)',
          },
        });
        if (!response.ok) throw new Error('Direct fetch failed');
      } catch (directFetchError) {
        console.log('Direct fetch failed, trying proxy:', directFetchError);
        // Use CORS proxy as fallback
        const proxyUrl = `/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
        response = await fetch(proxyUrl);
      }
      
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
        // Try multiple duration formats
        let duration = '0:00';
        const itunesDuration = item.querySelector('itunes\\:duration');
        const durationElement = item.querySelector('duration');
        
        if (itunesDuration?.textContent?.trim()) {
          duration = itunesDuration.textContent.trim();
        } else if (durationElement?.textContent?.trim()) {
          duration = durationElement.textContent.trim();
        }
        
        // If duration is empty or just whitespace, use default
        if (!duration || duration.trim() === '') {
          duration = '0:00';
        }
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
      const funding: RSSFunding[] = [];
      
      // Try both namespaced and non-namespaced versions for funding
      const fundingElements1 = Array.from(channel.getElementsByTagName('podcast:funding'));
      const fundingElements2 = Array.from(channel.getElementsByTagName('funding'));
      const allFundingElements = [...fundingElements1, ...fundingElements2];
      
      allFundingElements.forEach(fundingElement => {
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
      const podroll: RSSPodRoll[] = [];
      
      // Try both namespaced and non-namespaced versions for podroll containers
      const podrollElements1 = Array.from(channel.getElementsByTagName('podcast:podroll'));
      const podrollElements2 = Array.from(channel.getElementsByTagName('podroll'));
      const allPodrollElements = [...podrollElements1, ...podrollElements2];
      
      allPodrollElements.forEach(podrollElement => {
        // Look for podcast:remoteItem children within the podroll
        const remoteItems1 = Array.from(podrollElement.getElementsByTagName('podcast:remoteItem'));
        const remoteItems2 = Array.from(podrollElement.getElementsByTagName('remoteItem'));
        const allRemoteItems = [...remoteItems1, ...remoteItems2];
        
        allRemoteItems.forEach(remoteItem => {
          const feedUrl = remoteItem.getAttribute('feedUrl');
          const feedGuid = remoteItem.getAttribute('feedGuid');
          const title = remoteItem.getAttribute('title') || remoteItem.textContent?.trim();
          const description = remoteItem.getAttribute('description');
          
          if (feedUrl) {
            podroll.push({
              url: feedUrl,
              title: title || `Feed ${feedGuid ? feedGuid.substring(0, 8) + '...' : 'Unknown'}`,
              description: description || undefined
            });
          }
        });
        
        // Also check for direct url attributes on the podroll element (legacy format)
        const directUrl = podrollElement.getAttribute('url');
        const directTitle = podrollElement.getAttribute('title') || podrollElement.textContent?.trim();
        const directDescription = podrollElement.getAttribute('description');
        
        if (directUrl) {
          podroll.push({
            url: directUrl,
            title: directTitle || undefined,
            description: directDescription || undefined
          });
        }
      });
      
      console.log('🎲 Found PodRoll entries:', podroll);
      console.log('🎲 PodRoll details:', podroll.map(p => ({ url: p.url, title: p.title, description: p.description })));
      
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