import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if tables exist
    let tablesExist = false;
    let feedCount = 0;
    let trackCount = 0;
    
    try {
      feedCount = await prisma.feed.count();
      trackCount = await prisma.track.count();
      tablesExist = true;
    } catch (tableError) {
      console.error('Tables do not exist:', tableError);
    }
    
    return NextResponse.json({
      status: tablesExist ? 'healthy' : 'needs_migration',
      timestamp: new Date().toISOString(),
      database: 'connected',
      tables: tablesExist ? 'exist' : 'missing',
      feedCount,
      trackCount
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}