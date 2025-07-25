import { NextResponse } from 'next/server';
import { FeedManager } from '@/lib/feed-manager';

// Import the hardcoded feed mappings from the main page
const feedUrlMappings = [
  // Core Doerfels feeds - verified working (Albums)
  ['https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/music-from-the-doerfelverse.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/bloodshot-lies-album.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/intothedoerfelverse.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/intothedoerfelverse.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/wrath-of-banjo.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wrath-of-banjo.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/ben-doerfel.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/ben-doerfel.xml', 'album'],
  
  // Additional Doerfels albums and projects - all verified working (Albums)
  ['https://www.doerfelverse.com/feeds/18sundays.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/18sundays.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/alandace.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/alandace.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/autumn.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/autumn.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/christ-exalted.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/christ-exalted.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/come-back-to-me.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/come-back-to-me.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/dead-time-live-2016.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/dead-time-live-2016.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/dfbv1.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/dfbv1.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/dfbv2.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/dfbv2.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/disco-swag.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/disco-swag.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/first-married-christmas.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/first-married-christmas.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/generation-gap.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/generation-gap.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/heartbreak.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/heartbreak.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/merry-christmix.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/merry-christmix.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/middle-season-let-go.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/middle-season-let-go.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/phatty-the-grasshopper.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/possible.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/possible.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/pour-over.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/pour-over.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/psalm-54.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/psalm-54.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/sensitive-guy.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/sensitive-guy.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/they-dont-know.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/they-dont-know.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/think-ep.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/think-ep.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/underwater-single.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/underwater-single.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/unsound-existence.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/unsound-existence.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/you-are-my-world.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/you-are-my-world.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/you-feel-like-home.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/you-feel-like-home.xml', 'album'],
  ['https://www.doerfelverse.com/feeds/your-chance.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/your-chance.xml', 'album'],
  ['https://www.doerfelverse.com/artists/opus/opus/opus.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/opus.xml', 'album'],
  
  // Ed Doerfel (Shredward) projects - verified working (Albums)
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/nostalgic.xml', 'album'],
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/citybeach.xml', 'album'],
  ['https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/kurtisdrums-v1.xml', 'album'],
  
  // TJ Doerfel projects - verified working (Albums)
  ['https://www.thisisjdog.com/media/ring-that-bell.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/ring-that-bell.xml', 'album'],
  
  // External artists - verified working (Albums)
  ['https://ableandthewolf.com/static/media/feed.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/ableandthewolf-feed.xml', 'album'],
  ['https://static.staticsave.com/mspfiles/deathdreams.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/deathdreams.xml', 'album'],
  ['https://static.staticsave.com/mspfiles/waytogo.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/waytogo.xml', 'album'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/c_kostra/now%20i%20feel%20it.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/c-kostra-now-i-feel-it.xml', 'album'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Pilot/pilot.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/mellow-cassette-pilot.xml', 'album'],
  ['https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/radio_brigade.xml', 'https://re-podtards-cdn-new.b-cdn.net/feeds/mellow-cassette-radio-brigade.xml', 'album'],
  
  // Publisher feeds
  ['https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-artist-18bcbf10-6701-4ffb-b255-bc057390d738.xml', 'publisher'],
  ['https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-artist-8a9c2e54-785a-4128-9412-737610f5d00a.xml', 'publisher'],
  ['https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4', 'https://re-podtards-cdn-new.b-cdn.net/feeds/wavlake-artist-aa909244-7555-4b52-ad88-7233860c6fb4.xml', 'publisher'],
  
  // Heycitizen - External artist feeds
  ['https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/the heycitizen experience.xml', 'https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/the heycitizen experience.xml', 'album'],
  ['https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi.xml', 'https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi.xml', 'album'],
];

export async function POST() {
  try {
    const feedManager = FeedManager.getInstance();
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log(`🚀 Starting migration of ${feedUrlMappings.length} hardcoded feeds...`);

    for (const [originalUrl, cdnUrl, type] of feedUrlMappings) {
      try {
        // Skip if already exists (check by URL)
        const existingFeeds = await feedManager.getAllFeeds();
        const exists = existingFeeds.some(feed => feed.originalUrl === originalUrl);
        
        if (exists) {
          skippedCount++;
          console.log(`⏭️ Skipping existing feed: ${originalUrl}`);
          continue;
        }

        // Add the feed to the managed system
        await feedManager.addFeed(originalUrl, type as 'album' | 'publisher');
        migratedCount++;
        console.log(`✅ Migrated: ${originalUrl}`);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to migrate ${originalUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feed migration completed',
      results: {
        total: feedUrlMappings.length,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error during feed migration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}