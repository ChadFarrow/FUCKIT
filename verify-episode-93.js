const fs = require('fs');

// Load data
const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');

// Extract existing audio URLs
const audioTitles = new Set();
const audioMatch = audioModule.match(/"([^"]+)":\s*"[^"]+"/g);
if (audioMatch) {
  audioMatch.forEach(entry => {
    const [, title] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
    audioTitles.add(title);
  });
}

// Episode 93 GUIDs from the actual RSS feed
const episode93Guids = [
  { feedGuid: "a599fabe-6b73-58f3-88b8-a7b78a2976b5", itemGuid: "660c8516-ba38-480a-9ce7-e70a17427842" },
  { feedGuid: "ecb8f1a0-9196-5b19-8779-ecefcc419204", itemGuid: "faf08a67-7bf8-5899-80b8-89c53a871139" },
  { feedGuid: "2c5f77fe-25d9-5a2d-97ef-236718c627df", itemGuid: "4432ce16-974e-4e2a-b758-83ad9fc7acd9" },
  { feedGuid: "67711885-4a77-514e-ae6d-6ef3afaad41d", itemGuid: "6778c920-dc98-5e9d-9748-344f75eecf3d" },
  { feedGuid: "e0658b29-1cd3-55b8-ac51-0997764ce334", itemGuid: "9ed7ca50-11d8-418e-b33a-5f1b2779d34a" },
  { feedGuid: "92bb13ad-3ba7-5537-bf9a-893e311f4dbd", itemGuid: "486a3ae6-1ba3-457d-8bd0-66ef8aefdcc1" },
  { feedGuid: "3f38b0d6-d583-5b92-99bf-60a195bf764e", itemGuid: "afd49dd3-948e-5cf6-b411-4caad3c9c893" },
  { feedGuid: "57676ff4-82f4-589f-b8e7-d20e50e2dff9", itemGuid: "5e197c04-7446-424f-89ae-68b9863601db" },
  { feedGuid: "9906942b-7b18-5ad1-b2ac-57e2cf26c63d", itemGuid: "844c6167-28f8-5a59-8b32-9b85789cf919" },
  { feedGuid: "03682fbc-b8e7-505e-b5d2-8cb0f32ff2cf", itemGuid: "9d4389c6-5e6d-5f45-bbd7-d49e43f6414b" },
  { feedGuid: "89606593-efe1-5981-9fae-25eeb51e6cc0", itemGuid: "8627e0b8-567a-48fe-814f-42864a8a95fa" },
  { feedGuid: "e745b541-8bc1-42b5-9d2d-5c3a67817d47", itemGuid: "753702e0-1c0c-4996-9f25-09ac2bd40e94" },
  { feedGuid: "4f8daef6-bdc9-5996-9c0a-0d05d49207ad", itemGuid: "e7a58ca2-7a24-4087-b3ad-ededaf116356" }
];

console.log('🔍 Checking Episode 93 Tracks');
console.log('============================');

console.log(`📊 Episode 93 has ${episode93Guids.length} tracks according to RSS feed`);
console.log('');

episode93Guids.forEach((guid, index) => {
  // Find this track in our dataset
  const track = hghSongs.find(s => 
    s.feedGuid === guid.feedGuid && s.itemGuid === guid.itemGuid
  );
  
  if (track) {
    const hasAudio = audioTitles.has(track.title);
    const status = hasAudio ? '✅ HAS AUDIO' : '❌ MISSING AUDIO';
    
    console.log(`${index + 1}. "${track.title}" by ${track.artist}`);
    console.log(`   ${status}`);
    console.log(`   Feed: ${track.feedGuid}`);
    if (!hasAudio) {
      console.log(`   ⚠️ This track is missing audio URL!`);
    }
    console.log('');
  } else {
    console.log(`${index + 1}. NOT FOUND IN DATASET`);
    console.log(`   Feed: ${guid.feedGuid}`);
    console.log(`   Item: ${guid.itemGuid}`);
    console.log(`   ⚠️ This track from Episode 93 is not in our resolved data!`);
    console.log('');
  }
});

// Count missing
const missingFromEpisode93 = episode93Guids.filter(guid => {
  const track = hghSongs.find(s => 
    s.feedGuid === guid.feedGuid && s.itemGuid === guid.itemGuid
  );
  return !track || !audioTitles.has(track.title);
}).length;

console.log(`📊 Summary: ${missingFromEpisode93}/${episode93Guids.length} tracks from Episode 93 are missing audio URLs`);

if (missingFromEpisode93 === 0) {
  console.log('🎉 All Episode 93 tracks are actually working! The issue might be in my episode calculation.');
}