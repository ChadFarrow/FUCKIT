// Bunny.net CDN integration for RSS feed caching
// This handles uploading RSS feeds to Bunny.net storage for faster CDN delivery

interface BunnyCDNConfig {
  storageZone: string;
  accessKey: string;
  baseUrl: string;
  cdnUrl: string;
}

export class BunnyCDN {
  private config: BunnyCDNConfig;

  constructor() {
    this.config = {
      storageZone: process.env.BUNNY_STORAGE_ZONE || 'podtards-cdn-new',
      accessKey: process.env.BUNNY_STORAGE_PASSWORD || '',
      baseUrl: process.env.BUNNY_STORAGE_URL || 'https://storage.bunnycdn.com',
      cdnUrl: process.env.BUNNY_CDN_URL || 'https://re-podtards-cdn-new.b-cdn.net'
    };

    if (!this.config.accessKey) {
      console.warn('Bunny.net storage password not configured');
    }
  }

  /**
   * Upload RSS feed content to Bunny.net storage
   */
  async uploadFeed(feedContent: string, filename: string): Promise<string> {
    if (!this.config.accessKey) {
      throw new Error('Bunny.net storage password not configured');
    }

    const uploadUrl = `${this.config.baseUrl}/${this.config.storageZone}/feeds/${filename}`;
    
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': this.config.accessKey,
          'Content-Type': 'application/xml',
        },
        body: feedContent,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Return the CDN URL for the uploaded file
      const cdnUrl = `${this.config.cdnUrl}/feeds/${filename}`;
      console.log(`✅ Feed uploaded to CDN: ${cdnUrl}`);
      return cdnUrl;

    } catch (error) {
      console.error('❌ Failed to upload feed to Bunny.net:', error);
      throw error;
    }
  }

  /**
   * Fetch RSS feed from original URL and cache it to CDN
   */
  async cacheFeedToCDN(originalUrl: string, feedId: string): Promise<string> {
    try {
      console.log(`📡 Fetching feed from: ${originalUrl}`);
      
      // Fetch the original RSS feed
      const response = await fetch(originalUrl, {
        headers: {
          'User-Agent': 'ValueVerse-RSS-Cache/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      }

      const feedContent = await response.text();
      
      // Generate a clean filename for the CDN
      const filename = this.generateCDNFilename(originalUrl, feedId);
      
      // Upload to Bunny.net CDN
      const cdnUrl = await this.uploadFeed(feedContent, filename);
      
      return cdnUrl;

    } catch (error) {
      console.error('❌ Failed to cache feed to CDN:', error);
      throw error;
    }
  }

  /**
   * Generate a clean filename for CDN storage
   */
  private generateCDNFilename(originalUrl: string, feedId: string): string {
    try {
      const urlObj = new URL(originalUrl);
      const hostname = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '-');
      const pathname = urlObj.pathname
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Create a clean filename
      let filename = `${hostname}-${pathname}`;
      
      // Add .xml extension if not present
      if (!filename.endsWith('.xml')) {
        filename += '.xml';
      }
      
      // Fallback to feedId if URL parsing fails
      if (filename.length < 5 || filename === '.xml') {
        filename = `${feedId}.xml`;
      }
      
      return filename;
      
    } catch {
      // Fallback to feedId if URL parsing completely fails
      return `${feedId}.xml`;
    }
  }

  /**
   * Delete a feed from CDN storage
   */
  async deleteFeed(filename: string): Promise<boolean> {
    if (!this.config.accessKey) {
      console.warn('Bunny.net storage password not configured, cannot delete');
      return false;
    }

    const deleteUrl = `${this.config.baseUrl}/${this.config.storageZone}/feeds/${filename}`;
    
    try {
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'AccessKey': this.config.accessKey,
        },
      });

      if (response.ok || response.status === 404) {
        console.log(`🗑️ Feed deleted from CDN: ${filename}`);
        return true;
      } else {
        console.warn(`⚠️ Failed to delete feed: ${response.status} ${response.statusText}`);
        return false;
      }

    } catch (error) {
      console.error('❌ Error deleting feed from CDN:', error);
      return false;
    }
  }

  /**
   * Check if CDN is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.accessKey && this.config.storageZone);
  }

  /**
   * Get CDN configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      storageZone: this.config.storageZone,
      cdnUrl: this.config.cdnUrl,
      hasAccessKey: !!this.config.accessKey
    };
  }
}