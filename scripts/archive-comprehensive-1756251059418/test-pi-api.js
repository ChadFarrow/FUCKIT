const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY;
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

console.log('🔑 API Key:', PODCAST_INDEX_API_KEY ? 'Found' : 'Missing');
console.log('🔑 API Secret:', PODCAST_INDEX_API_SECRET ? 'Found' : 'Missing');

function getAuthHeaders() {
  const apiHeaderTime = Math.floor(Date.now() / 1000).toString();
  const hash = crypto
    .createHash('sha1')
    .update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime)
    .digest('hex');

  return {
    'X-Auth-Date': apiHeaderTime,
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'Authorization': hash,
    'User-Agent': 'StableKraft/1.0'
  };
}

async function testPodcastIndexAPI() {
  try {
    console.log('\n🧪 Testing basic Podcast Index API connection...');
    
    // Test with a known HGH feed GUID
    const testFeedGuid = '86f9ba78-7c4a-5bd2-a382-c6a88e9a96a0'; // The Great Disappointment
    const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${encodeURIComponent(testFeedGuid)}`;
    
    console.log('📡 Request URL:', url);
    console.log('📡 Headers:', getAuthHeaders());
    
    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    console.log('📡 Response status:', response.status, response.statusText);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ API Response:', JSON.stringify(data, null, 2));
    
    if (data.feed) {
      console.log('\n🎨 Feed artwork:', data.feed.artwork || data.feed.image || 'No artwork found');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPodcastIndexAPI();