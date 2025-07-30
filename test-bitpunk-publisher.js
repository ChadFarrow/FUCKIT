const fs = require('fs');
const path = require('path');

// Test Bitpunk.fm publisher functionality
function testBitpunkPublisher() {
  const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
  
  if (!fs.existsSync(parsedFeedsPath)) {
    console.error('Parsed feeds data not found');
    return;
  }

  const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
  const parsedData = JSON.parse(fileContent);
  
  console.log('🔍 Testing Bitpunk.fm publisher functionality...\n');
  
  // Find the Bitpunk.fm publisher feed
  const bitpunkPublisherFeed = parsedData.feeds.find((feed) => 
    feed.id === 'bitpunk-fm-publisher' && 
    feed.type === 'publisher' && 
    feed.parseStatus === 'success'
  );
  
  if (!bitpunkPublisherFeed) {
    console.error('❌ Bitpunk.fm publisher feed not found');
    return;
  }
  
  console.log('✅ Bitpunk.fm publisher feed found');
  console.log('📋 Publisher Info:', {
    title: bitpunkPublisherFeed.parsedData?.publisherInfo?.title,
    artist: bitpunkPublisherFeed.parsedData?.publisherInfo?.artist,
    description: bitpunkPublisherFeed.parsedData?.publisherInfo?.description,
    feedGuid: bitpunkPublisherFeed.parsedData?.publisherInfo?.feedGuid
  });
  
  // Check for remoteItems
  const remoteItems = bitpunkPublisherFeed.parsedData?.publisherInfo?.remoteItems || [];
  console.log(`📦 Remote Items: ${remoteItems.length} found`);
  
  remoteItems.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.feedUrl} (GUID: ${item.feedGuid})`);
  });
  
  // Find corresponding albums
  const allAlbums = parsedData.feeds
    .filter((feed) => feed.parseStatus === 'success' && feed.parsedData?.album)
    .map((feed) => feed.parsedData.album);
  
  console.log(`\n🎵 Total albums in system: ${allAlbums.length}`);
  
  // Match remoteItems to albums
  const matchedAlbums = [];
  remoteItems.forEach((item) => {
    const matchingAlbum = allAlbums.find((album) => 
      album.feedUrl === item.feedUrl ||
      album.link === item.feedUrl ||
      (album.publisher && album.publisher.feedGuid === item.feedGuid)
    );
    
    if (matchingAlbum) {
      matchedAlbums.push(matchingAlbum);
      console.log(`✅ Matched: ${matchingAlbum.title} (${matchingAlbum.artist})`);
    } else {
      console.log(`❌ No match found for: ${item.feedUrl}`);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`- Publisher feed: ✅ Found`);
  console.log(`- Remote items: ${remoteItems.length}`);
  console.log(`- Matched albums: ${matchedAlbums.length}`);
  console.log(`- Success rate: ${((matchedAlbums.length / remoteItems.length) * 100).toFixed(1)}%`);
  
  // Test URL generation
  const { generatePublisherSlug, getPublisherInfo } = require('./lib/url-utils.ts');
  
  console.log(`\n🔗 URL Testing:`);
  const publisherInfo = {
    title: 'Bitpunk.fm',
    artist: 'Bitpunk.fm',
    feedGuid: '5883e6be-4e0c-11f0-9524-00155dc57d8e'
  };
  
  const slug = generatePublisherSlug(publisherInfo);
  console.log(`Generated slug: ${slug}`);
  
  // Test different URL variations
  const testUrls = ['bitpunkfm', 'bitpunk-fm', '5883e6be'];
  testUrls.forEach(url => {
    const info = getPublisherInfo(url);
    if (info) {
      console.log(`✅ ${url} → ${info.name} (${info.feedGuid})`);
    } else {
      console.log(`❌ ${url} → Not found`);
    }
  });
}

testBitpunkPublisher(); 