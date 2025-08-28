import crypto from 'crypto';
import RSSParser from 'rss-parser';
import fs from 'fs';
import path from 'path';

class PodcastIndexRSSParser {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = 'https://api.podcastindex.org/api/1.0';
    this.rssParser = new RSSParser({
      customFields: {
        feed: [
          ['podcast:locked', 'locked'],
          ['podcast:funding', 'funding'],
          ['podcast:value', 'value'],
          ['podcast:guid', 'podcastGuid'],
          ['podcast:medium', 'medium'],
          ['podcast:person', 'person'],
          ['podcast:location', 'location'],
          ['podcast:remoteItem', 'remoteItem']
        ],
        item: [
          ['podcast:transcript', 'transcript'],
          ['podcast:chapters', 'chapters'],
          ['podcast:soundbite', 'soundbite'],
          ['podcast:person', 'person'],
          ['podcast:location', 'location'],
          ['podcast:season', 'season'],
          ['podcast:episode', 'episode'],
          ['podcast:value', 'value'],
          ['podcast:remoteItem', 'remoteItem']
        ]
      }
    });
  }

  generateAuthHeaders(apiKey, apiSecret) {
    const apiHeaderTime = Math.floor(Date.now() / 1000);
    const data4Hash = apiKey + apiSecret + apiHeaderTime;
    const hash4Header = crypto.createHash('sha1').update(data4Hash).digest('hex');
    
    return {
      'X-Auth-Date': apiHeaderTime.toString(),
      'X-Auth-Key': apiKey,
      'Authorization': hash4Header,
      'User-Agent': 'PodcastRSSParser/1.0'
    };
  }

  async lookupByFeedGuid(feedGuid) {
    try {
      const headers = this.generateAuthHeaders(this.apiKey, this.apiSecret);
      const url = `${this.baseUrl}/podcasts/byguid?guid=${encodeURIComponent(feedGuid)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status !== 'true' || !data.feed) {
        throw new Error('Feed not found or API error');
      }

      return data.feed;
    } catch (error) {
      console.error('Error looking up feed by GUID:', error);
      throw error;
    }
  }

  async fetchAndParseFeed(feedUrl) {
    try {
      const feed = await this.rssParser.parseURL(feedUrl);
      
      return {
        metadata: {
          title: feed.title,
          description: feed.description,
          link: feed.link,
          language: feed.language,
          copyright: feed.copyright,
          lastBuildDate: feed.lastBuildDate,
          pubDate: feed.pubDate,
          image: feed.image,
          itunes: feed.itunes,
          podcastGuid: feed.podcastGuid,
          locked: feed.locked,
          funding: feed.funding,
          value: feed.value,
          medium: feed.medium,
          person: feed.person,
          location: feed.location
        },
        items: feed.items.map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          creator: item.creator || item['dc:creator'],
          content: item.content,
          contentSnippet: item.contentSnippet,
          guid: item.guid,
          isoDate: item.isoDate,
          enclosure: item.enclosure,
          itunes: item.itunes,
          transcript: item.transcript,
          chapters: item.chapters,
          soundbite: item.soundbite,
          person: item.person,
          location: item.location,
          season: item.season,
          episode: item.episode,
          value: item.value
        }))
      };
    } catch (error) {
      console.error('Error fetching and parsing RSS feed:', error);
      throw error;
    }
  }

  async getCompletePocastData(feedGuid) {
    try {
      const feedInfo = await this.lookupByFeedGuid(feedGuid);
      
      if (!feedInfo.url) {
        throw new Error('Feed URL not found in API response');
      }

      const rssFeed = await this.fetchAndParseFeed(feedInfo.url);
      
      return {
        apiData: feedInfo,
        rssFeed: rssFeed,
        feedGuid: feedGuid,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting complete podcast data:', error);
      throw error;
    }
  }

  async searchPodcasts(query, options = {}) {
    try {
      const headers = this.generateAuthHeaders(this.apiKey, this.apiSecret);
      const params = new URLSearchParams({
        q: query,
        max: options.max || 20,
        ...options
      });
      
      const url = `${this.baseUrl}/search/byterm?${params}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status !== 'true') {
        throw new Error('Search failed or API error');
      }

      return data.feeds || [];
    } catch (error) {
      console.error('Error searching podcasts:', error);
      throw error;
    }
  }

  async getEpisodesByFeedId(feedId, options = {}) {
    try {
      const headers = this.generateAuthHeaders(this.apiKey, this.apiSecret);
      const params = new URLSearchParams({
        id: feedId,
        max: options.max || 10,
        ...options
      });
      
      const url = `${this.baseUrl}/episodes/byfeedid?${params}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status !== 'true') {
        throw new Error('Failed to get episodes or API error');
      }

      return data.items || [];
    } catch (error) {
      console.error('Error getting episodes by feed ID:', error);
      throw error;
    }
  }

  async getValueInfo(feedGuid) {
    try {
      const feedData = await this.getCompletePocastData(feedGuid);
      
      const valueInfo = {
        feedGuid: feedGuid,
        hasValue: false,
        valueData: null,
        fundingData: null
      };

      if (feedData.rssFeed.metadata.value) {
        valueInfo.hasValue = true;
        valueInfo.valueData = feedData.rssFeed.metadata.value;
      }

      if (feedData.rssFeed.metadata.funding) {
        valueInfo.fundingData = feedData.rssFeed.metadata.funding;
      }

      if (feedData.apiData.value) {
        valueInfo.apiValue = feedData.apiData.value;
      }

      return valueInfo;
    } catch (error) {
      console.error('Error getting value info:', error);
      throw error;
    }
  }

  async getItemByGuid(feedGuid, itemGuid) {
    try {
      const feedData = await this.getCompletePocastData(feedGuid);
      
      const item = feedData.rssFeed.items.find(item => item.guid === itemGuid);
      
      if (!item) {
        throw new Error(`Item with GUID ${itemGuid} not found in feed`);
      }

      return {
        feedInfo: {
          title: feedData.rssFeed.metadata.title,
          feedGuid: feedGuid,
          feedUrl: feedData.apiData.url
        },
        item: item,
        valueInfo: feedData.rssFeed.metadata.value || null
      };
    } catch (error) {
      console.error('Error getting item by GUID:', error);
      throw error;
    }
  }

  async getEpisodeByGuid(feedGuid, itemGuid) {
    try {
      const headers = this.generateAuthHeaders(this.apiKey, this.apiSecret);
      const url = `${this.baseUrl}/episodes/byguid?podcastguid=${encodeURIComponent(feedGuid)}&guid=${encodeURIComponent(itemGuid)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status !== 'true' || !data.episode) {
        throw new Error('Episode not found or API error');
      }

      return data.episode;
    } catch (error) {
      console.error('Error getting episode by GUID from API:', error);
      throw error;
    }
  }

  parseRemoteItem(remoteItemData) {
    if (!remoteItemData) return null;
    
    const remoteItems = Array.isArray(remoteItemData) ? remoteItemData : [remoteItemData];
    
    return remoteItems.map(item => {
      const parsed = {
        feedGuid: item.$?.feedGuid || null,
        feedUrl: item.$?.feedUrl || null,
        itemGuid: item.$?.itemGuid || null,
        medium: item.$?.medium || null
      };
      
      if (!parsed.feedGuid && !parsed.feedUrl) {
        console.warn('Remote item missing both feedGuid and feedUrl');
        return null;
      }
      
      return parsed;
    }).filter(item => item !== null);
  }

  async resolveRemoteItem(remoteItem) {
    try {
      let feedData;
      
      if (remoteItem.feedGuid) {
        feedData = await this.getCompletePocastData(remoteItem.feedGuid);
      } else if (remoteItem.feedUrl) {
        const rssFeed = await this.fetchAndParseFeed(remoteItem.feedUrl);
        feedData = { rssFeed };
      } else {
        throw new Error('Remote item must have either feedGuid or feedUrl');
      }

      if (remoteItem.itemGuid) {
        const item = feedData.rssFeed.items.find(item => item.guid === remoteItem.itemGuid);
        if (!item) {
          throw new Error(`Item ${remoteItem.itemGuid} not found in remote feed`);
        }
        return {
          type: 'item',
          feed: feedData.rssFeed.metadata,
          item: item,
          remoteItem: remoteItem
        };
      } else {
        return {
          type: 'feed',
          feed: feedData.rssFeed.metadata,
          items: feedData.rssFeed.items,
          remoteItem: remoteItem
        };
      }
    } catch (error) {
      console.error('Error resolving remote item:', error);
      throw error;
    }
  }

  async getRemoteItems(feedGuid) {
    try {
      const feedData = await this.getCompletePocastData(feedGuid);
      
      const remoteItems = [];
      
      if (feedData.rssFeed.metadata.remoteItem) {
        const parsed = this.parseRemoteItem(feedData.rssFeed.metadata.remoteItem);
        if (parsed) {
          remoteItems.push(...parsed.map(item => ({ ...item, location: 'feed' })));
        }
      }
      
      feedData.rssFeed.items.forEach((item, index) => {
        if (item.remoteItem) {
          const parsed = this.parseRemoteItem(item.remoteItem);
          if (parsed) {
            remoteItems.push(...parsed.map(remoteItem => ({
              ...remoteItem,
              location: 'item',
              itemIndex: index,
              itemTitle: item.title,
              itemGuid: item.guid
            })));
          }
        }
      });
      
      return remoteItems;
    } catch (error) {
      console.error('Error getting remote items:', error);
      throw error;
    }
  }

  async resolveAllRemoteItems(feedGuid) {
    try {
      const remoteItems = await this.getRemoteItems(feedGuid);
      
      const resolved = await Promise.allSettled(
        remoteItems.map(item => this.resolveRemoteItem(item))
      );
      
      return resolved.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            ...result.value,
            originalLocation: remoteItems[index].location,
            originalItem: remoteItems[index].itemTitle || null
          };
        } else {
          return {
            error: result.reason.message,
            remoteItem: remoteItems[index]
          };
        }
      });
    } catch (error) {
      console.error('Error resolving all remote items:', error);
      throw error;
    }
  }
}

export default PodcastIndexRSSParser;