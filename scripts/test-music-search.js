#!/usr/bin/env node

import { createRSSParser } from '../src/lib/rss-parser-config.js';

async function testMusicSearch() {
  const query = process.argv[2] || 'guitar';
  
  console.log(`\n🎵 TESTING MUSIC SEARCH API\n`);
  console.log(`Query: "${query}"`);
  console.log('═'.repeat(60));
  
  try {
    const parser = createRSSParser();
    
    console.log('\n🔍 Searching for music...\n');
    
    const musicResults = await parser.searchMusic(query, { max: 10 });
    
    console.log(`✅ Found ${musicResults.length} music results:\n`);
    
    musicResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title || result.name || 'Unknown Title'}`);
      console.log(`   Artist: ${result.author || result.itunesAuthor || 'Unknown Artist'}`);
      console.log(`   GUID: ${result.podcastGuid || 'N/A'}`);
      console.log(`   Feed ID: ${result.id || 'N/A'}`);
      console.log(`   URL: ${result.url || 'N/A'}`);
      console.log(`   Episodes: ${result.episodeCount || 'N/A'}`);
      console.log(`   Last Update: ${result.lastUpdateTime ? new Date(result.lastUpdateTime * 1000).toISOString() : 'N/A'}`);
      
      if (result.value) {
        console.log(`   ⚡ Value4Value: Enabled`);
      }
      
      if (result.categories) {
        console.log(`   Categories: ${Object.keys(result.categories).join(', ')}`);
      }
      
      console.log('');
    });
    
    // Let's also compare with regular podcast search to see the difference
    console.log('\n📻 Comparing with regular podcast search...\n');
    
    const podcastResults = await parser.searchPodcasts(query, { max: 5 });
    console.log(`Regular podcast search found ${podcastResults.length} results\n`);
    
    podcastResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title || result.name || 'Unknown Title'}`);
      console.log(`   Type: ${result.medium || 'podcast'}`);
      console.log(`   GUID: ${result.podcastGuid || 'N/A'}`);
      console.log('');
    });
    
    // If we found music results, let's try to fetch one and see what's in it
    if (musicResults.length > 0 && musicResults[0].podcastGuid && musicResults[0].url) {
      console.log('\n🎵 Sampling first music result...\n');
      
      try {
        const firstResult = musicResults[0];
        const completeData = await parser.getCompletePocastData(firstResult.podcastGuid);
        
        console.log(`✅ Successfully fetched: ${completeData.rssFeed.metadata.title}`);
        console.log(`   Tracks: ${completeData.rssFeed.items.length}`);
        
        if (completeData.rssFeed.items.length > 0) {
          console.log('\n   Sample tracks:');
          completeData.rssFeed.items.slice(0, 3).forEach((track, i) => {
            console.log(`   ${i + 1}. ${track.title} (${track.itunes?.duration || 'Unknown duration'})`);
          });
        }
        
        if (completeData.rssFeed.metadata.value) {
          console.log('\n   ⚡ Value4Value configuration found');
        }
        
      } catch (fetchError) {
        console.log(`   ⚠️ Could not fetch complete data: ${fetchError.message}`);
      }
    }
    
    console.log('\n═'.repeat(60));
    console.log('✨ Music search test complete!');
    
  } catch (error) {
    console.error('\n❌ Error during music search:', error.message);
    
    // Let's also check if the endpoint exists by trying a simple call
    console.log('\n🔍 Testing if the music search endpoint exists...');
    try {
      const parser = createRSSParser();
      const headers = parser.generateAuthHeaders(parser.apiKey, parser.apiSecret);
      const testUrl = `${parser.baseUrl}/search/music/byterm?q=test&max=1`;
      
      const response = await fetch(testUrl, { headers });
      console.log(`   Response status: ${response.status}`);
      
      if (response.status === 404) {
        console.log('   ❌ Music search endpoint not found (404)');
        console.log('   💡 The API might not have this endpoint yet');
      } else if (response.status === 200) {
        console.log('   ✅ Endpoint exists but search failed for other reasons');
      }
      
    } catch (endpointError) {
      console.log(`   Error testing endpoint: ${endpointError.message}`);
    }
    
    process.exit(1);
  }
}

testMusicSearch().catch(console.error);