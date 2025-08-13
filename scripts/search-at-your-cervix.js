#!/usr/bin/env node

const crypto = require('crypto');

// PodcastIndex API credentials
const API_KEY = 'VPFJTBBSB9KSPUZJZ3TF';
const API_SECRET = 's89wB4mCXhYVRWxk8huDftttk46d9JAFrzdMGVLc';

// Generate API signature
function generateSignature(apiKey, apiSecret, timestamp) {
  const data = apiKey + apiSecret + timestamp;
  return crypto.createHash('sha1').update(data).toString('hex');
}

async function searchAtYourCervix() {
  console.log('�� Searching PodcastIndex for "At Your Cervix"...');
  
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(API_KEY, API_SECRET, timestamp);
  
  const searchUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=At%20Your%20Cervix&pretty`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Podtards/1.0',
        'X-Auth-Key': API_KEY,
        'X-Auth-Signature': signature,
        'X-Auth-Timestamp': timestamp.toString()
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'true' && data.feeds && data.feeds.length > 0) {
      console.log(`✅ Found ${data.feeds.length} podcast(s) matching "At Your Cervix"`);
      
      data.feeds.forEach((feed, index) => {
        console.log(`\n📻 Podcast ${index + 1}:`);
        console.log(`   Title: ${feed.title}`);
        console.log(`   Artist: ${feed.author}`);
        console.log(`   Feed URL: ${feed.url}`);
        console.log(`   Artwork: ${feed.artwork || 'No artwork'}`);
        console.log(`   Description: ${feed.description?.substring(0, 100)}...`);
      });
      
      // Look for the best match
      const bestMatch = data.feeds.find(feed => 
        feed.title.toLowerCase().includes('at your cervix') ||
        feed.author.toLowerCase().includes('at your cervix')
      );
      
      if (bestMatch) {
        console.log(`\n🎯 Best Match Found:`);
        console.log(`   Title: ${bestMatch.title}`);
        console.log(`   Artist: ${bestMatch.author}`);
        console.log(`   Feed URL: ${bestMatch.url}`);
        console.log(`   Artwork URL: ${bestMatch.artwork || 'No artwork available'}`);
        
        if (bestMatch.artwork) {
          console.log(`\n✨ Real Artwork Available!`);
          console.log(`   URL: ${bestMatch.artwork}`);
          console.log(`   This can replace the placeholder in your database`);
        }
      }
      
    } else {
      console.log('❌ No podcasts found matching "At Your Cervix"');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error searching PodcastIndex:', error.message);
    
    if (error.message.includes('401')) {
      console.log('💡 This might be an authentication issue. Check your API credentials.');
    }
  }
}

// Run the search
searchAtYourCervix().catch(console.error);
