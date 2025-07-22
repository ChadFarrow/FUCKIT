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

export interface RSSPublisher {
  feedGuid: string;
  feedUrl: string;
  medium: string;
}

export interface RSSPublisherItem {
  feedGuid: string;
  feedUrl: string;
  medium: string;
  title?: string;
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
  publisher?: RSSPublisher;
}

export class RSSParser {
  static async parseAlbumFeed(feedUrl: string): Promise<RSSAlbum | null> {
    try {
      // For server-side fetching, always use direct URLs
      // For client-side fetching, use the proxy
      const isServer = typeof window === 'undefined';
      
      let response;
      if (isServer) {
        // Server-side: fetch directly
        response = await fetch(feedUrl);
      } else {
        // Client-side: use proxy
        const isAlreadyProxied = feedUrl.startsWith('/api/fetch-rss');
        const proxyUrl = isAlreadyProxied ? feedUrl : `/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
        response = await fetch(proxyUrl);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Use different XML parsing based on environment
      let xmlDoc: any;
      if (typeof window !== 'undefined') {
        // Browser environment
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      } else {
        // Server environment - use xmldom
        const { DOMParser } = await import('@xmldom/xmldom');
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      }
      
      // Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parserError) {
        throw new Error('Invalid XML format');
      }
      
      // Extract channel info
      const channels = xmlDoc.getElementsByTagName('channel');
      if (!channels || channels.length === 0) {
        throw new Error('Invalid RSS feed: no channel found');
      }
      const channel = channels[0];
      
      const titleElement = channel.getElementsByTagName('title')[0];
      const title = titleElement?.textContent?.trim() || 'Unknown Album';
      const descriptionElement = channel.getElementsByTagName('description')[0];
      const description = descriptionElement?.textContent?.trim() || '';
      const linkElement = channel.getElementsByTagName('link')[0];
      const link = linkElement?.textContent?.trim() || '';
      
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
      const authorElements = channel.getElementsByTagName('itunes:author');
      const authorElement = authorElements.length > 0 ? authorElements[0] : channel.getElementsByTagName('author')[0];
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
      

      
      // Use getElementsByTagName as it handles namespaces better than querySelector
      let imageElement: Element | null = channel.getElementsByTagName('itunes:image')[0] || null;
      if (!imageElement) {
        // Fallback to querySelector with escaped namespace
        imageElement = channel.querySelector('itunes\\:image');
      }
      
      if (imageElement) {
        coverArt = imageElement.getAttribute('href') || null;
      }
      if (!coverArt) {
        const imageUrl = channel.querySelector('image url');
        if (imageUrl) {
          coverArt = imageUrl.textContent?.trim() || null;
        }
      }
      
      // Try additional selectors for different image formats
      if (!coverArt) {
        const altImageElement = channel.querySelector('image');
        if (altImageElement) {
          const altUrl = altImageElement.getAttribute('url') || altImageElement.getAttribute('href');
          if (altUrl) {
            coverArt = altUrl;
          }
        }
      }
      
      // Extract additional channel metadata
      const subtitle = channel.getElementsByTagName('itunes:subtitle')[0]?.textContent?.trim();
      const summary = channel.getElementsByTagName('itunes:summary')[0]?.textContent?.trim();
      const languageEl = channel.getElementsByTagName('language')[0];
      const language = languageEl?.textContent?.trim();
      const copyrightEl = channel.getElementsByTagName('copyright')[0];
      const copyright = copyrightEl?.textContent?.trim();
      
      // Extract explicit rating
      const explicitEl = channel.getElementsByTagName('itunes:explicit')[0];
      const explicit = explicitEl?.textContent?.trim().toLowerCase() === 'true';
      
      // Extract keywords
      const keywordsEl = channel.getElementsByTagName('itunes:keywords')[0];
      const keywords = keywordsEl?.textContent?.trim().split(',').map((k: string) => k.trim()).filter((k: string) => k) || [];
      
      // Extract categories
      const categoryElements = channel.getElementsByTagName('itunes:category');
      const categories = Array.from(categoryElements).map((cat: unknown) => (cat as Element).getAttribute('text')).filter(Boolean) as string[];
      
      // Extract owner info
      const ownerEl = channel.getElementsByTagName('itunes:owner')[0];
      const owner = ownerEl ? {
        name: ownerEl.getElementsByTagName('itunes:name')[0]?.textContent?.trim(),
        email: ownerEl.getElementsByTagName('itunes:email')[0]?.textContent?.trim()
      } : undefined;

      // Extract tracks from items
      const items = xmlDoc.getElementsByTagName('item');
      const tracks: RSSTrack[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const trackTitle = item.getElementsByTagName('title')[0]?.textContent?.trim() || `Track ${i + 1}`;
        // Try multiple duration formats with better parsing
        let duration = '0:00';
        const itunesDuration = item.getElementsByTagName('itunes:duration')[0];
        const durationElement = item.getElementsByTagName('duration')[0];
        
        if (itunesDuration?.textContent?.trim()) {
          duration = itunesDuration.textContent.trim();
        } else if (durationElement?.textContent?.trim()) {
          duration = durationElement.textContent.trim();
        }
        
        // If duration is empty or just whitespace, use default
        if (!duration || duration.trim() === '') {
          duration = '0:00';
          console.log(`⚠️ No duration found for track "${trackTitle}", using default`);
        } else {
          // Convert seconds to MM:SS format if needed
          const durationStr = duration.trim();
          if (/^\d+$/.test(durationStr)) {
            // It's just seconds, convert to MM:SS
            const seconds = parseInt(durationStr);
            if (!isNaN(seconds) && seconds > 0) {
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              duration = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
          } else if (durationStr.includes(':')) {
            const parts = durationStr.split(':');
            if (parts.length === 2) {
              // MM:SS format
              const mins = parseInt(parts[0]);
              const secs = parseInt(parts[1]);
              if (!isNaN(mins) && !isNaN(secs) && mins >= 0 && secs >= 0 && secs < 60) {
                duration = `${mins}:${secs.toString().padStart(2, '0')}`;
              }
            } else if (parts.length === 3) {
              // HH:MM:SS format (like Wavlake uses)
              const hours = parseInt(parts[0]);
              const mins = parseInt(parts[1]);
              const secs = parseInt(parts[2]);
              if (!isNaN(hours) && !isNaN(mins) && !isNaN(secs) && 
                  hours >= 0 && mins >= 0 && mins < 60 && secs >= 0 && secs < 60) {
                const totalMinutes = hours * 60 + mins;
                const originalDuration = duration;
                duration = `${totalMinutes}:${secs.toString().padStart(2, '0')}`;
                if (hours > 0) {
                  console.log(`🔄 Converted HH:MM:SS "${originalDuration}" to MM:SS "${duration}" for "${trackTitle}"`);
                }
              }
            }
          }
        }
        const enclosureElement = item.getElementsByTagName('enclosure')[0];
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
        const trackKeywords = trackKeywordsEl?.textContent?.trim().split(',').map((k: string) => k.trim()).filter((k: string) => k) || [];
        
        tracks.push({
          title: trackTitle,
          duration: duration,
          url: url,
          trackNumber: i + 1,
          subtitle: cleanHtmlContent(trackSubtitle),
          summary: cleanHtmlContent(trackSummary),
          image: trackImage || undefined,
          explicit: trackExplicit,
          keywords: trackKeywords.length > 0 ? trackKeywords : undefined
        });
      }
      
      // Extract release date
      const pubDateElement = channel.getElementsByTagName('pubDate')[0] || channel.getElementsByTagName('lastBuildDate')[0];
      const releaseDate = pubDateElement?.textContent?.trim() || new Date().toISOString();
      
      // Extract funding information
      const funding: RSSFunding[] = [];
      
      // Try both namespaced and non-namespaced versions for funding
      const fundingElements1 = Array.from(channel.getElementsByTagName('podcast:funding'));
      const fundingElements2 = Array.from(channel.getElementsByTagName('funding'));
      const allFundingElements = [...fundingElements1, ...fundingElements2];
      
      allFundingElements.forEach((fundingElement: unknown) => {
        const element = fundingElement as Element;
        const url = element.getAttribute('url') || element.textContent?.trim();
        const message = element.textContent?.trim() || element.getAttribute('message');
        
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
      
      allPodrollElements.forEach((podrollElement: unknown) => {
        const podrollEl = podrollElement as Element;
        // Look for podcast:remoteItem children within the podroll
        const remoteItems1 = Array.from(podrollEl.getElementsByTagName('podcast:remoteItem'));
        const remoteItems2 = Array.from(podrollEl.getElementsByTagName('remoteItem'));
        const allRemoteItems = [...remoteItems1, ...remoteItems2];
        
        allRemoteItems.forEach((remoteItem: unknown) => {
          const remoteEl = remoteItem as Element;
          const feedUrl = remoteEl.getAttribute('feedUrl');
          const feedGuid = remoteEl.getAttribute('feedGuid');
          const title = remoteEl.getAttribute('title') || remoteEl.textContent?.trim();
          const description = remoteEl.getAttribute('description');
          
          if (feedUrl) {
            podroll.push({
              url: feedUrl,
              title: title || `Feed ${feedGuid ? feedGuid.substring(0, 8) + '...' : 'Unknown'}`,
              description: description || undefined
            });
          }
        });
        
        // Also check for direct url attributes on the podroll element (legacy format)
        const directUrl = podrollEl.getAttribute('url');
        const directTitle = podrollEl.getAttribute('title') || podrollEl.textContent?.trim();
        const directDescription = podrollEl.getAttribute('description');
        
        if (directUrl) {
          podroll.push({
            url: directUrl,
            title: directTitle || undefined,
            description: directDescription || undefined
          });
        }
      });
      
      // Extract Publisher information
      let publisher: RSSPublisher | undefined = undefined;
      
      // Look for podcast:remoteItem with medium="publisher"
      const remoteItems = Array.from(channel.getElementsByTagName('podcast:remoteItem'));
      const publisherRemoteItem = remoteItems.find((item: unknown) => {
        const element = item as Element;
        return element.getAttribute('medium') === 'publisher';
      });
      
      if (publisherRemoteItem) {
        const element = publisherRemoteItem as Element;
        const feedGuid = element.getAttribute('feedGuid');
        const feedUrl = element.getAttribute('feedUrl');
        const medium = element.getAttribute('medium');
        
        if (feedGuid && feedUrl && medium) {
          publisher = {
            feedGuid,
            feedUrl,
            medium
          };
        }
      }
      
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
        podroll: podroll.length > 0 ? podroll : undefined,
        publisher: publisher
      };
      
    } catch (error) {
      console.error('❌ Error parsing RSS feed:', error);
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        feedUrl
      });
      return null;
    }
  }
  
  static async parseMultipleFeeds(feedUrls: string[]): Promise<RSSAlbum[]> {
    console.log(`🔄 Parsing ${feedUrls.length} RSS feeds...`);
    
    // Process feeds in larger batches for better performance
    const batchSize = 20; // Increased from 10
    const results: RSSAlbum[] = [];
    
    for (let i = 0; i < feedUrls.length; i += batchSize) {
      const batch = feedUrls.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(feedUrls.length / batchSize)} (${batch.length} feeds)`);
      
      const promises = batch.map(url => this.parseAlbumFeed(url));
      const batchResults = await Promise.allSettled(promises);
      
      const successful = batchResults.filter((result): result is PromiseFulfilledResult<RSSAlbum> => 
        result.status === 'fulfilled' && result.value !== null);
      
      const failed = batchResults.filter(result => result.status === 'rejected' || result.value === null);
      
      if (failed.length > 0) {
        console.warn(`⚠️ Failed to parse ${failed.length} feeds in batch ${Math.floor(i / batchSize) + 1}`);
        // Only log first few failures to avoid console spam
        failed.slice(0, 3).forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`❌ Failed to parse feed ${batch[index]}: ${result.reason}`);
          } else if (result.status === 'fulfilled' && result.value === null) {
            console.error(`❌ Feed ${batch[index]} returned null`);
          }
        });
        if (failed.length > 3) {
          console.warn(`... and ${failed.length - 3} more failures`);
        }
      }
      
      results.push(...successful.map(result => result.value));
      
      // Reduced delay between batches for faster loading
      if (i + batchSize < feedUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms
      }
    }
    
    console.log(`✅ Successfully parsed ${results.length} albums from ${feedUrls.length} feeds`);
    return results;
  }

  static async parsePublisherFeedInfo(feedUrl: string): Promise<{ title?: string; description?: string; artist?: string; coverArt?: string } | null> {
    try {
      // For server-side fetching, always use direct URLs
      // For client-side fetching, use the proxy
      const isServer = typeof window === 'undefined';
      
      let response;
      if (isServer) {
        // Server-side: fetch directly
        response = await fetch(feedUrl);
      } else {
        // Client-side: use proxy
        const isAlreadyProxied = feedUrl.startsWith('/api/fetch-rss');
        const proxyUrl = isAlreadyProxied ? feedUrl : `/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
        response = await fetch(proxyUrl);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch publisher feed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Use different XML parsing based on environment
      let xmlDoc: any;
      if (typeof window !== 'undefined') {
        // Browser environment
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      } else {
        // Server environment - use xmldom
        const { DOMParser } = await import('@xmldom/xmldom');
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      }
      
      // Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parserError) {
        throw new Error('Invalid XML format');
      }
      
      // Extract channel info
      const channels = xmlDoc.getElementsByTagName('channel');
      if (!channels || channels.length === 0) {
        throw new Error('Invalid RSS feed: no channel found');
      }
      const channel = channels[0];
      
      const titleElement = channel.getElementsByTagName('title')[0];
      const title = titleElement?.textContent?.trim() || '';
      const descriptionElement = channel.getElementsByTagName('description')[0];
      const description = descriptionElement?.textContent?.trim() || '';
      
      // Extract artist from title or author
      let artist = title; // Use title as default artist name
      const authorElements = channel.getElementsByTagName('itunes:author');
      const authorElement = authorElements.length > 0 ? authorElements[0] : channel.getElementsByTagName('author')[0];
      if (authorElement) {
        artist = authorElement.textContent?.trim() || artist;
      }
      
      // Extract cover art
      let coverArt: string | null = null;
      let imageElement: Element | null = channel.getElementsByTagName('itunes:image')[0] || null;
      if (!imageElement) {
        // Fallback to querySelector with escaped namespace
        imageElement = channel.querySelector('itunes\\:image');
      }
      
      if (imageElement) {
        coverArt = imageElement.getAttribute('href') || null;
      }
      if (!coverArt) {
        const imageUrl = channel.querySelector('image url');
        if (imageUrl) {
          coverArt = imageUrl.textContent?.trim() || null;
        }
      }
      
      return {
        title,
        description,
        artist,
        coverArt: coverArt || undefined
      };
      
    } catch (error) {
      console.error('❌ Error parsing publisher feed info:', error);
      return null;
    }
  }

  static async parsePublisherFeed(feedUrl: string): Promise<RSSPublisherItem[]> {
    try {
      // For server-side fetching, always use direct URLs
      // For client-side fetching, use the proxy
      const isServer = typeof window === 'undefined';
      
      let response;
      if (isServer) {
        // Server-side: fetch directly
        response = await fetch(feedUrl);
      } else {
        // Client-side: use proxy
        const isAlreadyProxied = feedUrl.startsWith('/api/fetch-rss');
        const proxyUrl = isAlreadyProxied ? feedUrl : `/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
        response = await fetch(proxyUrl);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch publisher feed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Use different XML parsing based on environment
      let xmlDoc: any;
      if (typeof window !== 'undefined') {
        // Browser environment
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      } else {
        // Server environment - use xmldom
        const { DOMParser } = await import('@xmldom/xmldom');
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      }
      
      // Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parserError) {
        throw new Error('Invalid XML format');
      }
      
      // Extract channel info
      const channels = xmlDoc.getElementsByTagName('channel');
      if (!channels || channels.length === 0) {
        throw new Error('Invalid RSS feed: no channel found');
      }
      const channel = channels[0];
      
      const publisherItems: RSSPublisherItem[] = [];
      
      // Look for podcast:remoteItem elements with medium="music"
      const remoteItems = Array.from(channel.getElementsByTagName('podcast:remoteItem'));
      
      remoteItems.forEach((item: unknown) => {
        const element = item as Element;
        const medium = element.getAttribute('medium');
        const feedGuid = element.getAttribute('feedGuid');
        const feedUrl = element.getAttribute('feedUrl');
        const title = element.getAttribute('title') || element.textContent?.trim();
        
        if (medium === 'music' && feedGuid && feedUrl) {
          publisherItems.push({
            feedGuid,
            feedUrl,
            medium,
            title
          });
        }
      });
      
      console.log(`🏢 Found ${publisherItems.length} music items in publisher feed: ${feedUrl}`);
      return publisherItems;
      
    } catch (error) {
      console.error('❌ Error parsing publisher feed:', error);
      return [];
    }
  }

  static async parsePublisherFeedAlbums(feedUrl: string): Promise<RSSAlbum[]> {
    console.log(`🏢 Parsing publisher feed for albums: ${feedUrl}`);
    
    const publisherItems = await this.parsePublisherFeed(feedUrl);
    
    if (publisherItems.length === 0) {
      console.log(`📭 No music items found in publisher feed: ${feedUrl}`);
      return [];
    }
    
    const musicFeedUrls = publisherItems.map(item => item.feedUrl);
    console.log(`🎵 Loading ${musicFeedUrls.length} music feeds from publisher...`);
    
    const albums = await this.parseMultipleFeeds(musicFeedUrls);
    
    console.log(`🎶 Loaded ${albums.length} albums from publisher feed`);
    return albums;
  }
}