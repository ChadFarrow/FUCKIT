import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    // Load publisher feed results and music tracks to build publisher data
    let publisherFeeds: any[] = [];
    let musicTracks: any[] = [];
    let publisherMappings: any = {};
    
    try {
      // Load publisher feed results
      const publisherFeedsPath = path.join(process.cwd(), 'data', 'publisher-feed-results.json');
      if (fs.existsSync(publisherFeedsPath)) {
        const publisherFeedsContent = fs.readFileSync(publisherFeedsPath, 'utf-8');
        publisherFeeds = JSON.parse(publisherFeedsContent);
        console.log(`✅ Loaded ${publisherFeeds.length} publisher feeds`);
      }
      
      // Load music tracks to count albums per publisher
      const musicTracksPath = path.join(process.cwd(), 'data', 'music-tracks.json');
      if (fs.existsSync(musicTracksPath)) {
        const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf-8'));
        musicTracks = musicTracksData.musicTracks || [];
        console.log(`✅ Loaded ${musicTracks.length} music tracks`);
      }
      
      // Load manual publisher mappings
      const publisherMappingsPath = path.join(process.cwd(), 'data', 'publisher-mappings-manual.json');
      if (fs.existsSync(publisherMappingsPath)) {
        publisherMappings = JSON.parse(fs.readFileSync(publisherMappingsPath, 'utf-8'));
        console.log(`✅ Loaded manual publisher mappings`);
      }
    } catch (loadError) {
      console.error('Error loading publisher data:', loadError);
      return NextResponse.json({ 
        error: 'Failed to load publisher data',
        timestamp: new Date().toISOString()
      }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    // Group music tracks by feed to create album groups
    const albumGroups = new Map();
    musicTracks.forEach((track: any) => {
      const feedKey = track.feedGuid || track.feedUrl || 'unknown';
      if (!albumGroups.has(feedKey)) {
        albumGroups.set(feedKey, {
          feedGuid: track.feedGuid,
          feedUrl: track.feedUrl,
          feedTitle: track.feedTitle,
          feedArtist: track.feedArtist,
          tracks: []
        });
      }
      albumGroups.get(feedKey).tracks.push(track);
    });
    
    // Build publisher data with album counts
    const publishersMap = new Map();
    
    // Process each album group to find its publisher
    Array.from(albumGroups.values()).forEach((group: any) => {
      let publisherGuid = null;
      let publisherName = null;
      let publisherFeedUrl = null;
      
      // Check manual mappings first
      const albumGuid = group.feedGuid || group.feedUrl?.split('/').pop();
      for (const [guid, publisherData] of Object.entries(publisherMappings)) {
        if ((publisherData as any).albumGuids?.includes(albumGuid)) {
          publisherGuid = guid;
          publisherName = (publisherData as any).name;
          publisherFeedUrl = (publisherData as any).feedUrl;
          break;
        }
      }
      
      // Fallback to artist name matching with publisher feeds
      if (!publisherGuid && publisherFeeds.length > 0) {
        const artist = group.feedArtist || '';
        const matchingPublisher = publisherFeeds.find((pubFeed: any) => {
          const pubTitle = pubFeed.title?.replace('<![CDATA[', '').replace(']]>', '') || '';
          return pubTitle.toLowerCase() === artist.toLowerCase() ||
                 pubTitle.toLowerCase().includes(artist.toLowerCase()) ||
                 artist.toLowerCase().includes(pubTitle.toLowerCase());
        });
        
        if (matchingPublisher) {
          publisherGuid = matchingPublisher.feed.originalUrl.split('/').pop();
          publisherName = matchingPublisher.title?.replace('<![CDATA[', '').replace(']]>', '') || '';
          publisherFeedUrl = matchingPublisher.feed.originalUrl;
        }
      }
      
      if (publisherGuid && publisherName) {
        if (!publishersMap.has(publisherGuid)) {
          publishersMap.set(publisherGuid, {
            id: publisherGuid,
            title: publisherName,
            feedGuid: publisherGuid,
            originalUrl: publisherFeedUrl,
            albums: [],
            itemCount: 0
          });
        }
        
        const publisher = publishersMap.get(publisherGuid);
        publisher.albums.push({
          title: group.feedTitle,
          artist: group.feedArtist,
          trackCount: group.tracks.length,
          feedGuid: group.feedGuid,
          feedUrl: group.feedUrl
        });
        publisher.itemCount = publisher.albums.length;
      }
    });
    
    const publishers = Array.from(publishersMap.values());

    const response = {
      publishers,
      total: publishers.length,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300', // Cache for 5 minutes
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
    });
  } catch (error) {
    console.error('Unexpected error in publishers API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 