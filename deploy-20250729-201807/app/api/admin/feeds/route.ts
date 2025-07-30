import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export async function GET() {
  try {
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    
    if (!fsSync.existsSync(feedsPath)) {
      return NextResponse.json({
        success: true,
        feeds: [],
        count: 0
      });
    }

    const feedsData = JSON.parse(await fs.readFile(feedsPath, 'utf-8'));
    
    return NextResponse.json({
      success: true,
      feeds: feedsData.feeds || [],
      count: feedsData.feeds?.length || 0
    });
  } catch (error) {
    console.error('Error fetching feeds:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, type = 'album' } = body;

    // Validate inputs
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    if (!['album', 'publisher'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be "album" or "publisher"' },
        { status: 400 }
      );
    }

    // Load existing feeds
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    let feedsData;
    
    try {
      const feedsContent = await fs.readFile(feedsPath, 'utf-8');
      feedsData = JSON.parse(feedsContent);
    } catch (error) {
      // If file doesn't exist or is invalid, create new structure
      feedsData = {
        feeds: [],
        lastUpdated: new Date().toISOString()
      };
    }

    // Check if feed already exists
    const existingFeed = feedsData.feeds.find((feed: any) => feed.originalUrl === url);
    if (existingFeed) {
      return NextResponse.json(
        { success: false, error: 'Feed already exists' },
        { status: 409 }
      );
    }

    // Generate a unique ID from the URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, '-');
    const pathname = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const id = `${hostname}-${pathname}`.toLowerCase();

    // Create new feed entry
    const newFeed = {
      id,
      originalUrl: url,
      type,
      title: `Feed from ${urlObj.hostname}`,
      priority: 'low', // Default to low priority for user-added feeds
      status: 'active',
      addedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Add to feeds array
    feedsData.feeds.push(newFeed);
    feedsData.lastUpdated = new Date().toISOString();

    // Save back to file
    await fs.writeFile(feedsPath, JSON.stringify(feedsData, null, 2));

    console.log(`✅ Added new RSS feed: ${url} (${type})`);

    return NextResponse.json({
      success: true,
      message: 'Feed added successfully',
      feed: newFeed
    });
  } catch (error) {
    console.error('Error adding feed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}