const crypto = require('crypto');

// Test the PodcastIndex API with the actual GUIDs from the Doerfels feed
const PODCAST_INDEX_API_KEY = 'PHT7NRJC6JWBWRFQGUXS';
const PODCAST_INDEX_API_SECRET = '#7g8zk3fB#dPSaj$LcYYa9#2jHXu$6gmYSKJkJDL';

// Test GUIDs from the Doerfels feed
const testGuids = [
  { feedGuid: '3058af0c-1807-5732-9a08-9114675ef7d6', itemGuid: 'c51ecaa4-f237-4707-9c62-2de611820e4b' },
  { feedGuid: '011c3a82-d716-54f7-9738-3d5fcacf65be', itemGuid: 'c2ba80cc-add9-42ad-9a8f-b490436826ae' }
];

async function testPodcastIndexAPI() {
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1');
  hash.update(PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + apiHeaderTime);
  const hashString = hash.digest('hex');

  const headers = {
    'X-Auth-Key': PODCAST_INDEX_API_KEY,
    'X-Auth-Date': apiHeaderTime.toString(),
    'Authorization': hashString,
    'User-Agent': 're.podtards.com'
  };

  console.log('Testing PodcastIndex API...');
  console.log('Headers:', headers);

  for (const guid of testGuids) {
    console.log(`\n--- Testing Feed GUID: ${guid.feedGuid} ---`);
    
    try {
      // Try to get feed by ID
      const feedUrl = `https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${guid.feedGuid}`;
      console.log('Feed URL:', feedUrl);
      
      const feedResponse = await fetch(feedUrl, { headers });
      console.log('Feed Response Status:', feedResponse.status);
      
      if (feedResponse.ok) {
        const feedData = await feedResponse.json();
        console.log('Feed Data:', JSON.stringify(feedData, null, 2));
      } else {
        const errorText = await feedResponse.text();
        console.log('Feed Error:', errorText);
      }

      // Try to get episode by GUID
      console.log(`\n--- Testing Episode GUID: ${guid.itemGuid} ---`);
      const episodeUrl = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${guid.itemGuid}`;
      console.log('Episode URL:', episodeUrl);
      
      const episodeResponse = await fetch(episodeUrl, { headers });
      console.log('Episode Response Status:', episodeResponse.status);
      
      if (episodeResponse.ok) {
        const episodeData = await episodeResponse.json();
        console.log('Episode Data:', JSON.stringify(episodeData, null, 2));
      } else {
        const errorText = await episodeResponse.text();
        console.log('Episode Error:', errorText);
      }

    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

testPodcastIndexAPI().catch(console.error); 