import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function main() {
  const parser = createRSSParser();
  
  const exampleFeedGuids = [
    '917393e3-1b1e-5cef-ace4-edaa54e1f810',
    'c068d6b5-3375-54fa-a5de-6a24ecb3c33f',
    '8d584f41-191b-5405-a49f-46e27deb9c87'
  ];
  
  for (const feedGuid of exampleFeedGuids) {
    try {
      console.log(`\nFetching podcast with GUID: ${feedGuid}`);
      
      const feedInfo = await parser.lookupByFeedGuid(feedGuid);
      console.log(`Found: ${feedInfo.title}`);
      
      const completeData = await parser.getCompletePocastData(feedGuid);
      console.log(`  Episodes: ${completeData.rssFeed.items.length}`);
      console.log(`  Latest: ${completeData.rssFeed.items[0]?.title || 'N/A'}`);
      
      const valueInfo = await parser.getValueInfo(feedGuid);
      if (valueInfo.hasValue) {
        console.log(`  ⚡ Value4Value enabled`);
      }
    } catch (error) {
      console.error(`Error processing ${feedGuid}:`, error.message);
    }
  }
  
  console.log('\n--- Searching for podcasts ---');
  const searchResults = await parser.searchPodcasts('music', { max: 5 });
  console.log(`Found ${searchResults.length} music podcasts`);
  searchResults.forEach(feed => {
    console.log(`  • ${feed.title}`);
  });
}

main().catch(console.error);