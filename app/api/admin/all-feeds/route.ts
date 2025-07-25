import { NextResponse } from 'next/server';
import { FeedManager } from '@/lib/feed-manager';
import fs from 'fs/promises';
import path from 'path';

// Function to extract hardcoded feeds from the main page file
async function getHardcodedFeeds() {
  try {
    const mainPagePath = path.join(process.cwd(), 'app', 'page.tsx');
    const content = await fs.readFile(mainPagePath, 'utf-8');
    
    // Extract the feedUrlMappings array from the file
    const feedMappingsMatch = content.match(/const feedUrlMappings = \[([\s\S]*?)\];/);
    if (!feedMappingsMatch) {
      return [];
    }
    
    const mappingsString = feedMappingsMatch[1];
    
    // Parse the feed mappings (this is a simple regex approach)
    const feedLines = mappingsString.match(/\['([^']+)',\s*'([^']+)',\s*'([^']+)'\]/g) || [];
    
    return feedLines.map((line, index) => {
      const match = line.match(/\['([^']+)',\s*'([^']+)',\s*'([^']+)'\]/);
      if (match) {
        return {
          id: `hardcoded-${index}`,
          originalUrl: match[1],
          cdnUrl: match[2],
          type: match[3] as 'album' | 'publisher',
          title: `Hardcoded Feed ${index + 1}`,
          status: 'active' as const,
          isHardcoded: true,
          addedAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z'
        };
      }
      return null;
    }).filter(Boolean);
  } catch (error) {
    console.error('Error reading hardcoded feeds:', error);
    return [];
  }
}

export async function GET() {
  try {
    const feedManager = FeedManager.getInstance();
    
    // Get managed feeds
    const managedFeeds = await feedManager.getAllFeeds();
    
    // Get hardcoded feeds
    const hardcodedFeeds = await getHardcodedFeeds();
    
    // Combine both types
    const allFeeds = [
      ...hardcodedFeeds.map(feed => ({ ...feed, source: 'hardcoded' })),
      ...managedFeeds.map(feed => ({ ...feed, source: 'managed' }))
    ];
    
    return NextResponse.json({
      success: true,
      feeds: allFeeds,
      count: allFeeds.length,
      breakdown: {
        hardcoded: hardcodedFeeds.length,
        managed: managedFeeds.length,
        total: allFeeds.length
      }
    });
  } catch (error) {
    console.error('Error fetching all feeds:', error);
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