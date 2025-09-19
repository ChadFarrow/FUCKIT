import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const baseUrl = new URL(request.url).origin;
    console.log('🚀 Starting complete migration of all feeds...');
    
    let totalFeeds = 0;
    let totalTracks = 0;
    let allErrors: string[] = [];
    let currentIndex = 0;
    const batchSize = 25;
    
    while (true) {
      console.log(`📦 Running batch starting at index ${currentIndex}...`);
      
      // Make request to the batch migration endpoint
      const batchResponse = await fetch(`${baseUrl}/api/migrate-data?startIndex=${currentIndex}&batchSize=${batchSize}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        console.error(`❌ Batch failed at index ${currentIndex}:`, errorText);
        allErrors.push(`Batch ${currentIndex}: ${errorText}`);
        break;
      }
      
      const batchResult = await batchResponse.json();
      console.log(`✅ Batch complete:`, batchResult);
      
      // Accumulate results
      totalFeeds += batchResult.feedCount || 0;
      totalTracks += batchResult.trackCount || 0;
      if (batchResult.errors) {
        allErrors.push(...batchResult.errors);
      }
      
      // Check if we're done
      if (!batchResult.hasMore || !batchResult.nextStartIndex) {
        console.log(`🎉 All batches complete! Total: ${totalFeeds} feeds, ${totalTracks} tracks`);
        break;
      }
      
      // Move to next batch
      currentIndex = batchResult.nextStartIndex;
      
      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return NextResponse.json({
      success: true,
      message: 'Complete migration finished',
      totalFeeds,
      totalTracks,
      errors: allErrors.length > 0 ? allErrors : undefined,
      summary: `Successfully migrated ${totalFeeds} feeds with ${totalTracks} tracks`
    });
    
  } catch (error) {
    console.error('❌ Complete migration failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Complete migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}