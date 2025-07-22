import { MusicSiteData } from '@/types/music';

export class MusicSiteDataFetcher {
  static async buildCompleteSite(): Promise<MusicSiteData> {
    console.log('Building music site from local data only...');
    
    // Return minimal data structure with only local albums
    return {
      featuredPodcasts: [],
      recentEpisodes: [],
      musicCategories: [],
      trendingPodcasts: [],
      artistSpotlight: [],
      newReleases: [],
      topCharts: []
    };
  }
} 