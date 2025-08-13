#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const crypto = require('crypto');

// Full list of remote items to resolve (all 109)
const remoteItems = [
  { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "e046f9dd-aca3-4c7a-b396-2148a90ac0f2" },
  { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "822d7113-eab2-4857-82d2-cc0c1a52ce2b" },
  { feedGuid: "de032037-63e0-5c6b-820d-13d4319a2b19", itemGuid: "24f655ae-8918-4089-8f2c-4c5ef612088b" },
  { feedGuid: "5a95f9d8-35e3-51f5-a269-ba1df36b4bd8", itemGuid: "24d8aa8b-317c-4f03-86d2-65c454370fb8" },
  { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
  { feedGuid: "092e8cd8-6f44-5189-b574-9c0a5881b334", itemGuid: "35e81e15-6820-4f83-9a3d-4ef2cf0da14b" },
  { feedGuid: "e1e1fed5-4ca3-55b0-9370-182287ec24e5", itemGuid: "86a439b0-6b51-46a4-86f3-2490b7ca34ad" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "9ff8f18b-cc79-474c-a3e9-2948113b8bf5" },
  { feedGuid: "d6fe0d1c-bd8d-552b-ac66-cce620391810", itemGuid: "cf8a54a4-5cc2-4263-9ee2-a8d99697578a" },
  { feedGuid: "18843839-f79f-5b22-a842-241d0f6b12ea", itemGuid: "7bf430ff-6f92-4b44-bd3e-c4d0366e7508" },
  { feedGuid: "57203632-2003-55d2-b710-c699db963f18", itemGuid: "1f7e025c-e8f7-4e10-b12b-9715c9c460c7" },
  { feedGuid: "5d5be024-321d-5342-838e-988d1653296b", itemGuid: "191c7fee-5fde-4bdd-96c3-d7af3b4b8585" },
  { feedGuid: "08604071-83cc-5810-bec2-bea0f0cd0033", itemGuid: "0e4191ef-92d1-49a7-8691-8e691d6bfdda" },
  { feedGuid: "82235f8b-da8c-52a5-ba6b-1f11c199f526", itemGuid: "c6e47574-4fcd-4a56-b2df-9e404a556d15" },
  { feedGuid: "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4", itemGuid: "bfe9ed47-ac2a-4fc6-be19-6ab94f75c4c4" },
  { feedGuid: "1dc549bf-c1ef-5a30-813f-a2918d37b38d", itemGuid: "f5f51623-49f7-4c8d-ad7a-e1bafa10bab8" },
  { feedGuid: "377602c1-b049-5c14-bddf-eb4e349bee5c", itemGuid: "3634469f-61ad-4e42-97f2-f1335c6ad267" },
  { feedGuid: "47768d25-74d9-5ba4-82db-aeaa7f50e29c", itemGuid: "b1d3af49-e178-4153-94ab-8427e69429e4" },
  { feedGuid: "618f9e01-0ebb-5d59-b334-b428f7ebcc78", itemGuid: "22adf983-754f-47af-bf44-2224443c8f28" },
  { feedGuid: "b39fc3b2-2742-5944-a800-e87c42a093a3", itemGuid: "9db6d76b-fe9e-4914-bcc4-c429e0d75d6b" },
  { feedGuid: "1b59e954-db0a-5096-8116-2ef3638cbb66", itemGuid: "117e8cfe-2da4-5c5c-9060-0ac55808a137" },
  { feedGuid: "9e3cea98-d04d-5190-88b3-46ee6030d4ea", itemGuid: "e020b55d-3439-40a1-8271-ba2d59081608" },
  { feedGuid: "5bb8f186-2460-54dc-911d-54f642e8adf6", itemGuid: "213ba1ef-4751-4fc9-a33e-52c49f61c63a" },
  { feedGuid: "0ca05681-c035-5e50-b538-6e42328f0dfd", itemGuid: "454d3146-049c-49b1-b25e-c6551c083265" },
  { feedGuid: "f314df41-22c1-5fde-bc55-6f48e1625d96", itemGuid: "2ebf7868-7696-4520-9c9c-ff4900978427" },
  { feedGuid: "69c634ad-afea-5826-ad9a-8e1f06d6470b", itemGuid: "2b8cef29-6aa5-4e2f-a726-92f916f2424a" },
  { feedGuid: "b39fc3b2-2742-5944-a800-e87c42a093a3", itemGuid: "2fabcf8b-2c9a-4a0a-b895-3274043e5013" },
  { feedGuid: "999c4870-396c-5a6b-b22e-4c05ee46127d", itemGuid: "3f239db2-6d3c-4164-86c0-92c84f5caafa" },
  { feedGuid: "85e076c0-d4e3-5ae4-9586-0ab862dadf64", itemGuid: "8e175c89-437c-4543-ae0a-aba553da0e05" },
  { feedGuid: "a599fabe-6b73-58f3-88b8-a7b78a2976b5", itemGuid: "660c8516-ba38-480a-9ce7-e70a17427842" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "ae81976d-a05e-4ff9-9adf-cdb11a33fff9" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "7cececef-67c0-4e13-9192-943826d3eddd" },
  { feedGuid: "187f22db-79cb-5ac4-aa60-54e424e3915e", itemGuid: "17313b1e-3585-4bfa-9fb4-288636b84313" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "d2346732-acc5-4256-afe5-0a0f3e670e6b" },
  { feedGuid: "99d74aa0-2f55-5b2c-9c7a-47a3f31357f3", itemGuid: "b9b7d326-b583-477a-894b-b810da5b1f2e" },
  { feedGuid: "a599fabe-6b73-58f3-88b8-a7b78a2976b5", itemGuid: "849fa935-bf48-49c6-89e8-5d5b8dd024a2" },
  { feedGuid: "dbad52b9-6253-4a9b-bfab-246b9e839815", itemGuid: "fabc3e64-e470-4f97-bf4a-3957e481e23b" },
  { feedGuid: "dbad52b9-6253-4a9b-bfab-246b9e839815", itemGuid: "9c017289-79a4-40c2-a4fa-451041335db2" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "bbc9bfe3-3db1-400b-9ff0-613f57899614" },
  { feedGuid: "dbad52b9-6253-4a9b-bfab-246b9e839815", itemGuid: "339085cc-c70c-4a5f-ae9f-ecc745ac8a45" },
  { feedGuid: "acddbb03-064b-5098-87ca-9b146beb12e8", itemGuid: "0d616fe3-16ab-40be-a33c-98468f81fc11" },
  { feedGuid: "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4", itemGuid: "3587c342-cd4a-481c-838c-de242e5beb0b" },
  { feedGuid: "c73b1a23-1c28-5edb-94c3-10d1745d0877", itemGuid: "5342bf75-528c-417e-844b-1d2c69677aeb" },
  { feedGuid: "c76ef0a6-0181-5b9b-a4bc-dd85d4ed178b", itemGuid: "fe393a12-8545-440d-b88b-64e6568936fc" },
  { feedGuid: "08604071-83cc-5810-bec2-bea0f0cd0033", itemGuid: "2b77f75d-7f9b-4d47-864b-ccf495d4b1f4" },
  { feedGuid: "70b4915d-0c0b-5f7a-9980-82831d2a9ba2", itemGuid: "b9471140-0674-4884-bbb5-39ce9c4a000f" },
  { feedGuid: "52786c48-86b4-5fd9-b4fe-7b44dcc3e4ba", itemGuid: "13468078-1a54-4b0e-92bc-2faea2999ae7" },
  { feedGuid: "c8d77c9c-e661-5d79-8d5f-735cfe9a95b7", itemGuid: "17249ca4-fc26-45bb-afa3-d86212c9b2f8" },
  { feedGuid: "3074902b-b2dc-5877-bfc3-30f5df0fbe6a", itemGuid: "c59c7ffe-3847-4d55-ac27-5a1c1fbe6140" },
  { feedGuid: "2c5f77fe-25d9-5a2d-97ef-236718c627df", itemGuid: "469fb1ea-6b9e-4df4-96d3-0b61e9b1b5ca" },
  { feedGuid: "2c5f77fe-25d9-5a2d-97ef-236718c627df", itemGuid: "c5071214-ba27-4327-ae0b-4769fc9cac06" },
  { feedGuid: "b9ee4d5d-77e7-56a4-a195-397ae28a3dfe", itemGuid: "e92721f0-4291-4b50-a621-f658d875e640" },
  { feedGuid: "beeeef0b-51e9-52ac-b8d7-9ed54d5be3b0", itemGuid: "8ed4bcfe-a4f9-42a7-9529-d30c3d634656" },
  { feedGuid: "08604071-83cc-5810-bec2-bea0f0cd0033", itemGuid: "bb9c21e4-6c98-44b9-bf0b-125d244bd013" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "3aaaebf8-e10f-4058-82af-509b4a61689f" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "3b60e3d7-93c2-404e-8679-c541668fa121" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "765a7360-3c4c-4df6-becb-121abe595f4d" },
  { feedGuid: "537df90e-0cc4-535b-84d0-dcb3ca87f1f8", itemGuid: "33932ccc-c707-411b-b914-4e9a94ec7e89" },
  { feedGuid: "d518a5ad-4df1-413e-a4a4-f2c7e146e650", itemGuid: "7470d39e-6a8a-4356-9349-b9887d0970be" },
  { feedGuid: "d577b6cd-8c41-548b-abba-60e1502a94df", itemGuid: "https://justcast.com/shows/44721/audioposts/1246165" },
  { feedGuid: "c1dc15c3-a6e6-577b-8b4e-a7eae58fd40b", itemGuid: "https://justcast.com/shows/44808/audioposts/1248738" },
  { feedGuid: "70456036-6a9c-5165-8fa7-84352259d602", itemGuid: "ba10024a-d040-4b31-b61d-ea1fca19387d" },
  { feedGuid: "121c26b0-33f8-5cb9-9e14-d706bd3f5db8", itemGuid: "c2747138-3458-4a7d-b5be-7d2c637295bc" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "41339be2-3d61-4223-9641-3e7dd12be2b0" },
  { feedGuid: "bcd811d1-9fda-51d9-b2a6-9337f0131b66", itemGuid: "ddc7dff4-121b-43ac-81b2-74c9ab618e59" },
  { feedGuid: "7a0735a7-c2d2-5e2c-ad5a-8586a62bfc93", itemGuid: "3a5a784f-642f-41ab-b552-8c710415b8c6" },
  { feedGuid: "1ef2b1d6-c4c0-5ef5-b534-bfc025e4193e", itemGuid: "46aa7bd5-4355-5e6c-976d-323a4dd7b7ab" },
  { feedGuid: "d3e9bb7a-3df8-5b7e-8f52-0b01decf2b66", itemGuid: "360106a8-ddd8-4ee3-8bdf-2ef967b400ab" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "7f2eb92d-289e-4408-ac6c-47fea5905dc1" },
  { feedGuid: "94c8a0bf-f76e-5f8c-ba1d-c0c15a642271", itemGuid: "b8c2544f-88ec-4cc2-a30f-98d3e4c25aea" },
  { feedGuid: "babd1567-2803-5ede-9a19-302c2fbf9eae", itemGuid: "a2bf5272-8811-4882-aa39-a730c290af4d" },
  { feedGuid: "2ec344a8-d756-5f8f-bde1-8a034321f1cb", itemGuid: "c341b8f3-28b7-43c2-baff-b59eb6d8de8b" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "2f1fabc9-54c0-4e96-93d8-98737356b448" },
  { feedGuid: "87ef86af-9d75-5876-97f9-5ea46e6094f7", itemGuid: "eab9f1bd-94da-4c3c-afa7-3b4bc0c50c70" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "c2264e2b-a564-43d2-bf7e-5be6298e2ea2" },
  { feedGuid: "69c634ad-afea-5826-ad9a-8e1f06d6470b", itemGuid: "584953af-7321-4bfe-882d-7cadd697e807" },
  { feedGuid: "f511794d-437f-5cbd-8fcd-c541652a7931", itemGuid: "088c8c1b-4753-4bc6-9ae3-08bcbddb3aa1" },
  { feedGuid: "028e9f67-e0fc-558f-b598-25f06179cea3", itemGuid: "f6ee3774-c452-4e25-b8f4-c8330ff00f43" },
  { feedGuid: "4ab3741a-4a10-5631-a026-a9d0eb62fe11", itemGuid: "b24f24f6-6e49-4685-afc9-c9fa856a9f1e" },
  { feedGuid: "82235f8b-da8c-52a5-ba6b-1f11c199f526", itemGuid: "e580458f-ee8d-4674-b851-2e271cc3ff8e" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "26071e5e-74f4-4dd6-bb4f-19bfa259801f" },
  { feedGuid: "a2d2e313-9cbd-5169-b89c-ab07b33ecc33", itemGuid: "ae81976d-a05e-4ff9-9adf-cdb11a33fff9" },
  { feedGuid: "6335b366-6a83-5df4-ba62-d356ede08d70", itemGuid: "62767045-5cc0-4280-a552-145a56e6964a" },
  { feedGuid: "cb086537-5673-57a8-9c78-72542da2a7d4", itemGuid: "9a29c9f0-649f-4ddd-8888-55ed84d7c2ab" },
  { feedGuid: "e0658b29-1cd3-55b8-ac51-0997764ce334", itemGuid: "32dd5103-548b-4b0a-ba56-13088637c1d5" },
  { feedGuid: "6eef0b66-bb86-5d0c-b260-099bcc920b7c", itemGuid: "bd305f20-3c55-47b1-9722-6d68aeeaede7" },
  { feedGuid: "a599fabe-6b73-58f3-88b8-a7b78a2976b5", itemGuid: "660c8516-ba38-480a-9ce7-e70a17427842" },
  { feedGuid: "545a3589-88e6-57c5-8448-bdc056cc3dfb", itemGuid: "e7d7bf4f-811c-4644-9897-3f78cd2afa00" },
  { feedGuid: "3074902b-b2dc-5877-bfc3-30f5df0fbe6a", itemGuid: "c59c7ffe-3847-4d55-ac27-5a1c1fbe6140" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "ae930ad6-5966-4033-b17f-b4e39519701d" },
  { feedGuid: "5bb8f186-2460-54dc-911d-54f642e8adf6", itemGuid: "213ba1ef-4751-4fc9-a33e-52c49f61c63a" },
  { feedGuid: "5bb8f186-2460-54dc-911d-54f642e8adf6", itemGuid: "f69cd5a5-2018-411b-afc1-00ab12142e83" },
  { feedGuid: "5bb8f186-2460-54dc-911d-54f642e8adf6", itemGuid: "3c506193-5247-41bf-9d5d-6d8c7571142c" },
  { feedGuid: "66740bed-5dca-540f-98ff-0411593dab82", itemGuid: "c660daaf-c499-4c36-af7c-f41171d9b612" },
  { feedGuid: "ec20d4ed-76c2-50dc-b4d9-0ba407f8cd81", itemGuid: "55e1640d-5de7-448f-94ec-7cc2797e245a" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "eb69c0a1-c8b3-4898-8eef-af496d04a4e5" },
  { feedGuid: "c8d77c9c-e661-5d79-8d5f-735cfe9a95b7", itemGuid: "17249ca4-fc26-45bb-afa3-d86212c9b2f8" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "caae8d61-bedd-40d9-ad57-8c86c1509020" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "58c9b50a-6d5f-4dcd-90ae-e3a76a9d2c0e" },
  { feedGuid: "b84c3345-55db-54e0-ac41-4b1cc6f3df67", itemGuid: "6941fa17-0b82-4acf-aba0-79bdb219c98f" },
  { feedGuid: "bba99401-378c-5540-bf95-c456b3d4de26", itemGuid: "804099cb-264f-42cc-8026-18f989c08f2b" },
  { feedGuid: "69c634ad-afea-5826-ad9a-8e1f06d6470b", itemGuid: "3e3d88cd-d20e-4999-9239-70a8c762749b" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "a58d266a-2421-4772-9ae9-83ebbeb80d79" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "fedb7f31-c90a-4aca-9ab8-87db350af674" },
  { feedGuid: "2b62ef49-fcff-523c-b81a-0a7dde2b0609", itemGuid: "be4da809-a7d3-42fb-aec9-7050144bf814" },
  { feedGuid: "1e7ed1fa-0456-5860-9b34-825d1335d8f8", itemGuid: "5334a806-1c60-481e-a978-7577ce988b56" },
  { feedGuid: "c76ef0a6-0181-5b9b-a4bc-dd85d4ed178b", itemGuid: "fe393a12-8545-440d-b88b-64e6568936fc" },
  { feedGuid: "d13eab76-a4c4-5e4b-a0fb-25ed1386bc51", itemGuid: "58cf0bcf-bf66-46a1-8759-314def6d76e5" }
];

async function generateAuthHeaders(apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(apiKey + apiSecret + timestamp).digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-Music-Discovery/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash
  };
}

async function resolveRemoteItem(feedGuid, itemGuid, index, total) {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('Missing PODCAST_INDEX_API_KEY or PODCAST_INDEX_API_SECRET in environment');
  }

  try {
    const headers = await generateAuthHeaders(apiKey, apiSecret);
    
    // Use podcastguid instead of feedguid parameter (FIXED)
    const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}&podcastguid=${encodeURIComponent(feedGuid)}`;
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      return { error: `${response.status}: ${await response.text()}`, index, feedGuid, itemGuid };
    }
    
    const data = await response.json();
    
    if (!data.episode) {
      return { error: 'No episode found', index, feedGuid, itemGuid };
    }
    
    const episode = data.episode;
    
    // Extract music track data
    const track = {
      feedGuid: feedGuid,
      itemGuid: itemGuid,
      feedUrl: episode.feedUrl || '',
      feedTitle: episode.feedTitle || '',
      title: episode.title || '',
      artist: episode.feedTitle?.replace(/\s*(podcast|music|songs?|tracks?|album).*$/i, '').trim() || '',
      album: episode.feedTitle || '',
      description: episode.description || '',
      duration: episode.duration || episode.length || '0',
      enclosureUrl: episode.enclosureUrl || '',
      enclosureType: episode.enclosureType || 'audio/mpeg',
      pubDate: episode.datePublished || new Date().toISOString(),
      image: episode.image || episode.feedImage || '',
      value: episode.value || null,
      resolvedFrom: 'direct-feed-fetch',
      resolvedAt: new Date().toISOString()
    };
    
    return { track, index, feedGuid, itemGuid };
    
  } catch (error) {
    return { error: error.message, index, feedGuid, itemGuid };
  }
}

async function saveToDatabase(track) {
  try {
    const dbPath = path.join(__dirname, '../data/music-tracks.json');
    
    // Read existing data
    let data = { musicTracks: [], episodes: [], feeds: [], valueTimeSplits: [], valueRecipients: [], boostagrams: [], funding: [], extractions: [], analytics: [], metadata: {} };
    
    if (fs.existsSync(dbPath)) {
      const existingData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      data = existingData;
    }
    
    // Check for duplicates
    const exists = data.musicTracks.find(t => t.feedGuid === track.feedGuid && t.itemGuid === track.itemGuid);
    if (exists) {
      return { duplicate: true, track: exists };
    }
    
    // Generate unique ID
    const existingIds = new Set(data.musicTracks.map(t => t.id));
    let trackId = `track-${data.musicTracks.length + 1}`;
    let counter = data.musicTracks.length + 1;
    while (existingIds.has(trackId)) {
      counter++;
      trackId = `track-${counter}`;
    }
    
    // Add track with ID and timestamp
    const trackWithId = {
      id: trackId,
      ...track,
      addedAt: new Date().toISOString()
    };
    
    data.musicTracks.push(trackWithId);
    
    // Update metadata
    data.metadata = {
      ...data.metadata,
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalTracks: data.musicTracks.length,
      totalEpisodes: data.episodes.length,
      totalFeeds: data.feeds.length,
      totalExtractions: data.extractions.length,
      cleanSlate: true
    };
    
    // Save updated data
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    
    return { saved: true, track: trackWithId };
  } catch (error) {
    console.error('❌ Error saving to database:', error);
    throw error;
  }
}

async function main() {
  console.log(`🚀 Processing all ${remoteItems.length} remote items with fixed API call...`);
  
  // Process items in parallel batches
  const BATCH_SIZE = 15;
  let successful = 0;
  let failed = 0;
  let duplicates = 0;
  
  for (let i = 0; i < remoteItems.length; i += BATCH_SIZE) {
    const batch = remoteItems.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remoteItems.length / BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} items)`);
    
    const promises = batch.map((item, batchIndex) => 
      resolveRemoteItem(item.feedGuid, item.itemGuid, i + batchIndex + 1, remoteItems.length)
    );
    
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const data = result.value;
        
        if (data.error) {
          console.log(`❌ [${data.index}/${remoteItems.length}] ${data.error.slice(0, 60)}`);
          failed++;
        } else if (data.track) {
          try {
            const saveResult = await saveToDatabase(data.track);
            if (saveResult.duplicate) {
              console.log(`⏭️  [${data.index}/${remoteItems.length}] Duplicate: "${data.track.title}"`);
              duplicates++;
            } else {
              console.log(`✅ [${data.index}/${remoteItems.length}] Added: "${data.track.title}" by ${data.track.artist}`);
              successful++;
            }
          } catch (saveError) {
            console.error(`❌ [${data.index}/${remoteItems.length}] Save failed: ${saveError.message}`);
            failed++;
          }
        }
      } else {
        console.error(`❌ Promise failed: ${result.reason}`);
        failed++;
      }
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < remoteItems.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`\n🏁 Processing complete!`);
  console.log(`✅ Successfully resolved and saved: ${successful}`);
  console.log(`⏭️  Duplicates skipped: ${duplicates}`);
  console.log(`❌ Failed to resolve: ${failed}`);
  console.log(`📊 Total processed: ${successful + duplicates + failed}/${remoteItems.length}`);
  
  if (successful > 0) {
    // Run the conversion script to update parsed-feeds.json
    console.log('\n🔄 Running conversion script to update albums...');
    try {
      const { execSync } = require('child_process');
      execSync('node scripts/rebuild-parsed-feeds-from-tracks.js', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('✅ Albums conversion completed');
    } catch (error) {
      console.error('❌ Error running conversion script:', error.message);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}