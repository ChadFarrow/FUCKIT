const crypto = require('crypto');

// Use environment variables for API credentials
const PODCAST_INDEX_API_KEY = process.env.PODCAST_INDEX_API_KEY || 'MV5XQPRMUX3SCTXMGNVG';
const PODCAST_INDEX_API_SECRET = process.env.PODCAST_INDEX_API_SECRET || 'eX9vbbV2SfgGctENDDjethfnKP2VAwMgYTDkQ9ce';

// All missing feedGuids from Unknown Artist tracks
const missingFeedGuids = [
  "011c3a82-d716-54f7-9738-3d5fcacf65be",
  "028e9f67-e0fc-558f-b598-25f06179cea3",
  "08604071-83cc-5810-bec2-bea0f0cd0033",
  "092e8cd8-6f44-5189-b574-9c0a5881b334",
  "0ab5bc9d-c9fb-52f4-8b8c-64be5edf322f",
  "0ca05681-c035-5e50-b538-6e42328f0dfd",
  "187f22db-79cb-5ac4-aa60-54e424e3915e",
  "18843839-f79f-5b22-a842-241d0f6b12ea",
  "1b59e954-db0a-5096-8116-2ef3638cbb66",
  "1dc549bf-c1ef-5a30-813f-a2918d37b38d",
  "1e7ed1fa-0456-5860-9b34-825d1335d8f8",
  "1ef2b1d6-c4c0-5ef5-b534-bfc025e4193e",
  "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
  "2ec344a8-d756-5f8f-bde1-8a034321f1cb",
  "3058af0c-1807-5732-9a08-9114675ef7d6",
  "3074902b-b2dc-5877-bfc3-30f5df0fbe6a",
  "377602c1-b049-5c14-bddf-eb4e349bee5c",
  "3ae285ab-434c-59d8-aa2f-59c6129afb92",
  "47768d25-74d9-5ba4-82db-aeaa7f50e29c",
  "4ab3741a-4a10-5631-a026-a9d0eb62fe11",
  "537df90e-0cc4-535b-84d0-dcb3ca87f1f8",
  "545a3589-88e6-57c5-8448-bdc056cc3dfb",
  "57203632-2003-55d2-b710-c699db963f18",
  "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8",
  "5bb8f186-2460-54dc-911d-54f642e8adf6",
  "5d5be024-321d-5342-838e-988d1653296b",
  "618f9e01-0ebb-5d59-b334-b428f7ebcc78",
  "6335b366-6a83-5df4-ba62-d356ede08d70",
  "66740bed-5dca-540f-98ff-0411593dab82",
  "69c634ad-afea-5826-ad9a-8e1f06d6470b",
  "6bf3785f-e053-57f4-9f70-261ee5e3747f",
  "6eef0b66-bb86-5d0c-b260-099bcc920b7c",
  "6fc2ad98-d4a8-5d70-9c68-62e9efc1209c",
  "7a0735a7-c2d2-5e2c-ad5a-8586a62bfc93",
  "82235f8b-da8c-52a5-ba6b-1f11c199f526",
  "85e076c0-d4e3-5ae4-9586-0ab862dadf64",
  "87ef86af-9d75-5876-97f9-5ea46e6094f7",
  "94c8a0bf-f76e-5f8c-ba1d-c0c15a642271",
  "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4",
  "999c4870-396c-5a6b-b22e-4c05ee46127d",
  "99d74aa0-2f55-5b2c-9c7a-47a3f31357f3",
  "9e3cea98-d04d-5190-88b3-46ee6030d4ea",
  "a2d2e313-9cbd-5169-b89c-ab07b33ecc33",
  "a599fabe-6b73-58f3-88b8-a7b78a2976b5",
  "acddbb03-064b-5098-87ca-9b146beb12e8",
  "b39fc3b2-2742-5944-a800-e87c42a093a3",
  "b84c3345-55db-54e0-ac41-4b1cc6f3df67",
  "babd1567-2803-5ede-9a19-302c2fbf9eae",
  "bba99401-378c-5540-bf95-c456b3d4de26",
  "bcd811d1-9fda-51d9-b2a6-9337f0131b66",
  "c73b1a23-1c28-5edb-94c3-10d1745d0877",
  "c76ef0a6-0181-5b9b-a4bc-dd85d4ed178b",
  "cb086537-5673-57a8-9c78-72542da2a7d4",
  "d13eab76-a4c4-5e4b-a0fb-25ed1386bc51",
  "d3e9bb7a-3df8-5b7e-8f52-0b01decf2b66",
  "d6fe0d1c-bd8d-552b-ac66-cce620391810",
  "dbad52b9-6253-4a9b-bfab-246b9e839815",
  "de032037-63e0-5c6b-820d-13d4319a2b19",
  "dea01a9d-a024-5b13-84aa-b157304cd3bc",
  "e0658b29-1cd3-55b8-ac51-0997764ce334",
  "e1e1fed5-4ca3-55b0-9370-182287ec24e5",
  "ec20d4ed-76c2-50dc-b4d9-0ba407f8cd81",
  "f314df41-22c1-5fde-bc55-6f48e1625d96",
  "f511794d-437f-5cbd-8fcd-c541652a7931"
];

async function lookupFeedGuid(feedGuid) {
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

  const url = `https://api.podcastindex.org/api/1.0/podcasts/byguid?guid=${feedGuid}`;
  
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.status === 'true' && data.feed) {
      console.log(`✅ ${feedGuid}: ${data.feed.title} - ${data.feed.author}`);
      return {
        feedGuid,
        title: data.feed.title,
        url: data.feed.url,
        author: data.feed.author
      };
    } else {
      console.log(`❌ ${feedGuid}: Not found`);
      return null;
    }
  } catch (error) {
    console.error(`❌ ${feedGuid}: Error -`, error.message);
    return null;
  }
}

async function main() {
  console.log(`🔍 Looking up ${missingFeedGuids.length} missing feedGuids...\n`);
  
  const results = [];
  const batchSize = 5; // Rate limit to avoid overwhelming the API
  
  for (let i = 0; i < missingFeedGuids.length; i += batchSize) {
    const batch = missingFeedGuids.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingFeedGuids.length/batchSize)}...`);
    
    const batchPromises = batch.map(feedGuid => lookupFeedGuid(feedGuid));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults.filter(result => result !== null));
    
    // Rate limit: wait 1 second between batches
    if (i + batchSize < missingFeedGuids.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n\n📋 V4V Resolver entries for ${results.length} successfully resolved feeds:`);
  console.log('Copy and paste these into the V4V resolver:\n');
  
  results.forEach(result => {
    // Clean up the title and author for the comment
    const title = result.title.replace(/'/g, "\\'");
    const author = result.author.replace(/'/g, "\\'");
    console.log(`    '${result.feedGuid}': '${result.url}', // ${title} - ${author}`);
  });
  
  console.log(`\n✅ Successfully resolved ${results.length}/${missingFeedGuids.length} feedGuids`);
}

main().catch(console.error);