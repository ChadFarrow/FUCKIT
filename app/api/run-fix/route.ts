import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const fixes = [
  { old: 'Wavlake Album 1', new: 'Tinderbox', artist: 'Nate Johnivan' },
  { old: 'Wavlake Album 2', new: 'Singles', artist: 'Nate Johnivan' },
  { old: 'Wavlake Album 5', new: 'Fight!', artist: 'Nate Johnivan' },
  { old: 'Wavlake Album 16', new: 'THEY RIDE', artist: 'IROH' }
];

export async function GET() {
  try {
    console.log('🔧 Starting title fixes...');
    const results = [];
    
    for (const fix of fixes) {
      try {
        const result = await prisma.feed.updateMany({
          where: { title: fix.old },
          data: { 
            title: fix.new,
            artist: fix.artist,
            lastFetched: new Date()
          }
        });
        
        console.log(`✅ "${fix.old}" → "${fix.new}" (${result.count} updated)`);
        results.push({
          old: fix.old,
          new: fix.new,
          artist: fix.artist,
          updated: result.count,
          status: 'success'
        });
      } catch (error) {
        console.error(`❌ Error fixing "${fix.old}":`, error);
        results.push({
          old: fix.old,
          new: fix.new,
          error: (error as Error).message,
          status: 'error'
        });
      }
    }
    
    console.log('🎉 Title fixes completed!');
    
    return NextResponse.json({
      success: true,
      message: 'Title fixes completed',
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Fix script failed:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

export async function POST() {
  return GET(); // Allow both GET and POST
}