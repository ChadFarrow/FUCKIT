import { Metadata } from 'next';
import PublisherDetailClient from './PublisherDetailClient';
import { getPublisherInfo } from '@/lib/url-utils';
import fs from 'fs';
import path from 'path';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const publisherId = decodeURIComponent(id);
  
  // Get publisher info to show proper name in title
  const publisherInfo = getPublisherInfo(publisherId);
  const publisherName = publisherInfo?.name || publisherId;
  
  return {
    title: `${publisherName} | re.podtards.com`,
    description: `View all albums from ${publisherName}`,
  };
}

async function loadPublisherData(publisherId: string) {
  // First, try to resolve human-readable slug to actual feedGuid
  const publisherInfo = getPublisherInfo(publisherId);
  const actualFeedGuid = publisherInfo?.feedGuid || publisherId;
  
  try {
    // Load from the new publisher feed results
    const publisherFeedsPath = path.join(process.cwd(), 'data', 'publisher-feed-results.json');
    
    if (!fs.existsSync(publisherFeedsPath)) {
      console.error('Publisher feeds file not found at:', publisherFeedsPath);
      return null;
    }

    const fileContent = fs.readFileSync(publisherFeedsPath, 'utf-8');
    const publisherFeeds = JSON.parse(fileContent);
    
    console.log(`🏢 Server-side: Looking for publisher: ${publisherId}`);
    
    // Try to find publisher by title match (case-insensitive)
    const publisherFeed = publisherFeeds.find((feed: any) => {
      const cleanTitle = feed.title?.replace('<![CDATA[', '').replace(']]>', '').toLowerCase() || '';
      return cleanTitle === publisherId.toLowerCase();
    });
    
    if (!publisherFeed) {
      console.log(`❌ Publisher not found: ${publisherId}`);
      console.log(`🔍 Available publishers:`, publisherFeeds.map((f: any) => 
        f.title?.replace('<![CDATA[', '').replace(']]>', '') || 'Unknown'
      ));
      return null;
    }
    
    console.log(`✅ Publisher found: ${publisherFeed.title}`);
    
    // Convert to expected format
    const data = {
      publisherInfo: {
        name: publisherFeed.title?.replace('<![CDATA[', '').replace(']]>', '') || publisherId,
        description: publisherFeed.description?.replace('<![CDATA[', '').replace(']]>', '') || '',
        image: publisherFeed.itunesImage || null,
        feedUrl: publisherFeed.feed.originalUrl,
        feedGuid: publisherFeed.feed.originalUrl.split('/').pop() || ''
      },
      publisherItems: [], // Will be populated by client-side API call
      feedId: publisherFeed.feed.id
    };
    
    console.log(`🏢 Server-side: Found publisher data for ${publisherId}:`, {
      name: data.publisherInfo.name,
      feedGuid: data.publisherInfo.feedGuid
    });
    
    return data;
  } catch (error) {
    console.error('Error loading publisher data:', error);
    return null;
  }
}

export default async function PublisherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publisherId = decodeURIComponent(id);
  
  // Load publisher data server-side
  const publisherData = await loadPublisherData(publisherId);
  
  return <PublisherDetailClient publisherId={publisherId} initialData={publisherData} />;
}