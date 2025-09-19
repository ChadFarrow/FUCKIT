import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🔄 Starting database initialization...');
    
    // First check if we can connect
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    let tablesExist = false;
    try {
      await prisma.feed.count();
      tablesExist = true;
      console.log('✅ Tables already exist');
    } catch (error) {
      console.log('❌ Tables do not exist, need to deploy schema');
    }
    
    if (!tablesExist) {
      // Try to deploy the schema
      try {
        console.log('🔄 Deploying database schema...');
        // This will create the tables based on the Prisma schema
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Feed" (
            "id" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT,
            "originalUrl" TEXT NOT NULL,
            "image" TEXT,
            "artist" TEXT,
            "language" TEXT,
            "category" TEXT,
            "explicit" BOOLEAN NOT NULL DEFAULT false,
            "type" TEXT NOT NULL DEFAULT 'music',
            "priority" TEXT NOT NULL DEFAULT 'normal',
            "status" TEXT NOT NULL DEFAULT 'active',
            "lastFetched" TIMESTAMP(3),
            "lastError" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
          )
        `;
        
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Track" (
            "id" TEXT NOT NULL,
            "feedId" TEXT NOT NULL,
            "guid" TEXT,
            "title" TEXT NOT NULL,
            "subtitle" TEXT,
            "description" TEXT,
            "artist" TEXT,
            "album" TEXT,
            "audioUrl" TEXT NOT NULL,
            "duration" INTEGER,
            "explicit" BOOLEAN NOT NULL DEFAULT false,
            "image" TEXT,
            "publishedAt" TIMESTAMP(3),
            "itunesAuthor" TEXT,
            "itunesSummary" TEXT,
            "itunesImage" TEXT,
            "itunesDuration" TEXT,
            "itunesKeywords" TEXT[],
            "itunesCategories" TEXT[],
            "v4vRecipient" TEXT,
            "v4vValue" JSONB,
            "startTime" INTEGER,
            "endTime" INTEGER,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
          )
        `;
        
        await prisma.$executeRaw`
          ALTER TABLE "Track" ADD CONSTRAINT "Track_feedId_fkey" 
          FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `;
        
        console.log('✅ Database schema deployed');
      } catch (schemaError) {
        console.error('❌ Failed to deploy schema:', schemaError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create database schema',
          details: schemaError instanceof Error ? schemaError.message : 'Unknown error'
        }, { status: 500 });
      }
    }
    
    // Check if we have data
    const feedCount = await prisma.feed.count();
    const trackCount = await prisma.track.count();
    
    console.log(`📊 Current data: ${feedCount} feeds, ${trackCount} tracks`);
    
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      feedCount,
      trackCount,
      tablesExisted: tablesExist
    });
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}