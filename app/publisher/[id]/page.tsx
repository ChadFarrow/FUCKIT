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
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.error('Parsed feeds file not found at:', parsedFeedsPath);
      return null;
    }

    const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
    const parsedFeedsData = JSON.parse(fileContent);
    
    // Find the publisher feed by ID
    const feedId = `${publisherId}-publisher`;
    console.log(`🏢 Server-side: Looking for publisher feed with ID: ${feedId}`);
    
    const publisherFeed = parsedFeedsData.feeds.find((feed: any) => 
      feed.type === 'publisher' && 
      feed.parseStatus === 'success' &&
      feed.parsedData &&
      feed.id === feedId
    );
    
    if (!publisherFeed) {
      console.log(`❌ Publisher feed not found: ${publisherId} (resolved to: ${actualFeedGuid})`);
      console.log(`🔍 Available publisher feeds:`, parsedFeedsData.feeds
        .filter((f: any) => f.type === 'publisher')
        .map((f: any) => f.id)
      );
      return null;
    }
    
    console.log(`✅ Publisher feed found: ${publisherFeed.id}`);
    
    const data = {
      publisherInfo: publisherFeed.parsedData?.publisherInfo || null,
      publisherItems: publisherFeed.parsedData?.publisherItems || publisherFeed.parsedData?.publisherInfo?.remoteItems || [],
      feedId: publisherFeed.id
    };
    
    console.log(`🏢 Server-side: Found publisher data for ${publisherId}:`, {
      publisherItemsCount: data.publisherItems.length,
      sampleItem: data.publisherItems[0]
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