const fs = require('fs');
const path = require('path');

async function testDataService() {
  console.log('🧪 Testing DataService.findAlbumsByFeedGuids logic...');
  
  // Load the parsed feeds data directly
  const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
  const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
  const data = JSON.parse(fileContent);
  const feeds = data.feeds || [];
  
  console.log(`📋 Loaded ${feeds.length} feeds`);
  
  // Test with the first few feedGuids from the doerfels publisher
  const testFeedGuids = [
    '2b62ef49-fcff-523c-b81a-0a7dde2b0609',
    '5a95f9d8-35e3-51f5-a269-ba1df36b4bd8',
    '41aace28-8679-5ef1-9958-75cf76c2b5f0'
  ];
  
  console.log('📋 Testing with feedGuids:', testFeedGuids);
  
  const matchedAlbums = [];
  
  for (const feedGuid of testFeedGuids) {
    console.log(`\n🔍 Processing feedGuid: ${feedGuid}`);
    
    // First, try to find the publisherItem that contains this feedGuid to get the feedUrl
    let targetFeedUrl = null;
    
    // Search through all publisher feeds to find the publisherItem with this feedGuid
    const publisherFeeds = feeds.filter(feed => 
      feed.type === 'publisher' && 
      feed.parseStatus === 'success' &&
      (feed.parsedData?.publisherItems || feed.parsedData?.publisherInfo?.publisherItems)
    );

    console.log(`📊 Found ${publisherFeeds.length} publisher feeds to search`);

    for (const publisherFeed of publisherFeeds) {
      // Get publisherItems from either location
      const publisherItems = publisherFeed.parsedData?.publisherItems || publisherFeed.parsedData?.publisherInfo?.publisherItems || [];
      
      // Find the publisherItem that matches this feedGuid
      const publisherItem = publisherItems.find((item) => 
        item.feedGuid === feedGuid
      );

      if (publisherItem?.feedUrl) {
        targetFeedUrl = publisherItem.feedUrl;
        console.log(`✅ Found feedUrl for feedGuid ${feedGuid}: ${targetFeedUrl}`);
        break;
      }
    }

    if (targetFeedUrl) {
      // Now find the album feed that matches this URL
      const urlMatch = feeds.find(feed => 
        feed.originalUrl === targetFeedUrl &&
        feed.parseStatus === 'success' && 
        feed.parsedData?.album
      );

      if (urlMatch?.parsedData?.album) {
        matchedAlbums.push(urlMatch.parsedData.album);
        console.log(`✅ URL match found: ${urlMatch.parsedData.album.title}`);
        continue;
      } else {
        console.log(`❌ No album feed found for URL: ${targetFeedUrl}`);
      }
    } else {
      console.log(`❌ No feedUrl found for feedGuid: ${feedGuid}`);
    }
  }
  
  console.log(`\n🎵 Final results: Found ${matchedAlbums.length} albums`);
  matchedAlbums.forEach((album, index) => {
    console.log(`  ${index + 1}. ${album.title} by ${album.artist}`);
  });
}

testDataService(); 