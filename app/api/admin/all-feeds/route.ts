import { NextResponse } from 'next/server';

// Simplified admin API - returns basic feed info without FeedManager
export async function GET() {
  try {
    // Return hardcoded feeds for admin display
    const hardcodedFeeds = [
      { originalUrl: 'https://value4value.live/feeds/doerfels.xml', type: 'album' },
      { originalUrl: 'https://podcastindex.org/api/1.0/episodes/byfeedurl?url=https%3A%2F%2Fchrisdobrien.podhome.fm%2Frss&pretty', type: 'album' },
      { originalUrl: 'https://rss.buzzsprout.com/2022460.rss', type: 'album' },
      { originalUrl: 'https://value4value.live/feeds/ajjohnson.xml', type: 'album' },
      { originalUrl: 'https://value4value.live/feeds/chasity.xml', type: 'album' },
      { originalUrl: 'https://value4value.live/feeds/bobdylan.xml', type: 'album' },
      { originalUrl: 'https://value4value.live/feeds/caseyjones.xml', type: 'album' },
      { originalUrl: 'https://value4value.live/feeds/dannyboy.xml', type: 'album' },
      { originalUrl: 'https://value4value.live/feeds/sirtj.xml', type: 'album' },
      { originalUrl: 'https://value4value.live/feeds/shredward.xml', type: 'album' },
      { originalUrl: 'https://feeds.buzzsprout.com/2181713.rss', type: 'album' },
      { originalUrl: 'https://rss.buzzsprout.com/1996760.rss', type: 'album' },
    ];

    const feedsForAdmin = hardcodedFeeds.map((feed, index) => ({
      id: `hardcoded-${index}`,
      originalUrl: feed.originalUrl,
      cdnUrl: feed.originalUrl,
      type: feed.type as 'album' | 'publisher',
      status: 'active' as const,
      source: 'hardcoded' as const,
      title: '',
      artist: '',
      addedAt: new Date().toISOString(),
      lastFetched: new Date().toISOString(),
      lastError: null,
      albumCount: 0
    }));
    
    return NextResponse.json({
      success: true,
      feeds: feedsForAdmin
    });
  } catch (error) {
    console.error('Error fetching all feeds:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feeds' },
      { status: 500 }
    );
  }
}