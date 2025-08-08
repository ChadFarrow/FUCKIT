import { NextRequest, NextResponse } from 'next/server';
import { RSSParser } from '@/lib/rss-parser';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testPublisher = searchParams.get('publisher');
    const debug = searchParams.get('debug');
    
    if (testPublisher === 'true') {
      console.log('🧪 Testing publisher feed parsing...');
      
      if (debug === 'true') {
        // Debug mode: fetch and parse the raw XML to see all remote items
        const response = await fetch('https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml');
        const xmlText = await response.text();
        
        // Use xmldom to parse
        const { DOMParser } = await import('@xmldom/xmldom');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const channel = xmlDoc.getElementsByTagName('channel')[0];
        const remoteItems = Array.from(channel.getElementsByTagName('podcast:remoteItem'));
        
        const allItems = remoteItems.map((item: unknown) => {
          const element = item as Element;
          return {
            feedGuid: element.getAttribute('feedGuid'),
            feedUrl: element.getAttribute('feedUrl'),
            medium: element.getAttribute('medium'),
            title: element.getAttribute('title'),
            feedImg: element.getAttribute('feedImg')
          };
        });
        
        return NextResponse.json({
          message: 'Publisher feed debug info',
          totalItems: allItems.length,
          items: allItems,
          note: 'Items without medium="music" are being filtered out by current parser'
        });
      }
      
      const publisherItems = await RSSParser.parsePublisherFeed('https://www.doerfelverse.com/feeds/doerfels-pubfeed.xml');
      
      return NextResponse.json({
        message: 'Publisher feed parsed successfully',
        publisherItems: publisherItems.map(item => ({
          feedGuid: item.feedGuid,
          feedUrl: item.feedUrl,
          medium: item.medium,
          title: item.title
        })),
        count: publisherItems.length
      });
    }
    
    console.log('🧪 Testing single feed parsing...');
    
    const result = await RSSParser.parseAlbumFeed('https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml');
    
    console.log('📦 Parse result:', result ? 'SUCCESS' : 'NULL');
    
    if (result) {
      return NextResponse.json({
        message: 'Single feed parsed successfully',
        album: {
          title: result.title,
          artist: result.artist,
          trackCount: result.tracks.length,
          firstTrack: result.tracks[0]?.title,
          publisher: result.publisher,
          value4Value: result.value4Value ? {
            hasTimeSplits: !!result.value4Value.timeSplits?.length,
            timeSplitsCount: result.value4Value.timeSplits?.length || 0,
            hasFunding: !!result.value4Value.funding?.length,
            hasBoostagrams: !!result.value4Value.boostagrams?.length
          } : null,
          categories: result.categories,
          explicit: result.explicit,
          language: result.language
        }
      });
    } else {
      return NextResponse.json({
        message: 'Single feed returned null',
        error: 'No album data parsed'
      });
    }
  } catch (error) {
    console.error('❌ Single feed test error:', error);
    return NextResponse.json({ 
      error: 'Failed to parse single feed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 