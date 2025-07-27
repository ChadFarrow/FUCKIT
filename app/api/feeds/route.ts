import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    
    if (!fs.existsSync(feedsPath)) {
      return NextResponse.json({ error: 'Feeds configuration not found' }, { status: 404 });
    }

    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf-8'));
    
    // Filter active feeds and organize by priority
    const activeFeeds = feedsData.feeds.filter((feed: any) => feed.status === 'active');
    
    const organizedFeeds = {
      core: activeFeeds.filter((feed: any) => feed.priority === 'core'),
      extended: activeFeeds.filter((feed: any) => feed.priority === 'extended'),
      low: activeFeeds.filter((feed: any) => feed.priority === 'low'),
      all: activeFeeds
    };

    return NextResponse.json(organizedFeeds, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error loading feeds configuration:', error);
    return NextResponse.json(
      { error: 'Failed to load feeds configuration' },
      { status: 500 }
    );
  }
}