import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const titleUpdates = [
  {
    searchTitle: 'Wavlake Album 1',
    newTitle: 'Tinderbox',
    artist: 'Nate Johnivan'
  },
  {
    searchTitle: 'Wavlake Album 16',
    newTitle: 'THEY RIDE',
    artist: 'IROH'
  },
  {
    searchTitle: 'Wavlake Album 2',
    newTitle: 'Singles',
    artist: 'Nate Johnivan'
  },
  {
    searchTitle: 'Wavlake Album 5',
    newTitle: 'Fight!',
    artist: 'Nate Johnivan'
  }
];

export async function POST() {
  try {
    console.log('🔧 Starting quick title fixes...');
    
    let updated = 0;
    const results = [];
    
    for (const update of titleUpdates) {
      try {
        const feed = await prisma.feed.findFirst({
          where: { title: update.searchTitle }
        });
        
        if (feed) {
          await prisma.feed.update({
            where: { id: feed.id },
            data: {
              title: update.newTitle,
              artist: update.artist,
              lastFetched: new Date()
            }
          });
          
          updated++;
          results.push({
            feedId: feed.id,
            oldTitle: update.searchTitle,
            newTitle: update.newTitle,
            artist: update.artist,
            status: 'updated'
          });
          console.log(`✅ Updated: "${update.searchTitle}" → "${update.newTitle}"`);
        } else {
          results.push({
            oldTitle: update.searchTitle,
            status: 'not_found'
          });
          console.log(`⚠️ Not found: "${update.searchTitle}"`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${update.searchTitle}:`, error);
        results.push({
          oldTitle: update.searchTitle,
          status: 'error',
          error: (error as Error).message
        });
      }
    }
    
    console.log(`📊 Summary: Updated ${updated} titles`);
    
    return NextResponse.json({
      success: true,
      updated,
      results
    });
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Title fix endpoint ready',
    updates: titleUpdates.length
  });
}