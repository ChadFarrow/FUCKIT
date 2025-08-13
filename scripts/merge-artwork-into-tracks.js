#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('�� Starting artwork merge into main track database...');

// Load the main music tracks database
const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const musicTracksData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));

console.log(`📊 Loaded ${musicTracksData.musicTracks.length} tracks from main database`);

// Load HGH artwork URLs
const hghArtworkPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
let hghArtworkContent = fs.readFileSync(hghArtworkPath, 'utf8');

// Extract the artwork map from the TypeScript file
const hghArtworkMatch = hghArtworkContent.match(/export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = ({[\s\S]*?});/);
if (!hghArtworkMatch) {
  console.error('❌ Could not extract HGH artwork map from TypeScript file');
  process.exit(1);
}

// Convert the TypeScript object to a JavaScript object
let hghArtworkMap;
try {
  // Remove the TypeScript type annotation and export declaration
  const hghArtworkStr = hghArtworkMatch[1];
  hghArtworkMap = eval('(' + hghArtworkStr + ')');
} catch (error) {
  console.error('❌ Error parsing HGH artwork map:', error);
  process.exit(1);
}

console.log(`🎨 Loaded ${Object.keys(hghArtworkMap).length} HGH artwork URLs`);

// Load ITDV artwork URLs
const itdvArtworkPath = path.join(__dirname, '..', 'data', 'itdv-artwork-urls.ts');
let itdvArtworkContent = fs.readFileSync(itdvArtworkPath, 'utf8');

// Extract the artwork map from the TypeScript file
const itdvArtworkMatch = itdvArtworkContent.match(/export const ITDV_ARTWORK_URL_MAP: ITDVArtworkUrlMap = ({[\s\S]*?});/);
if (!itdvArtworkMatch) {
  console.error('❌ Could not extract ITDV artwork map from TypeScript file');
  process.exit(1);
}

// Convert the TypeScript object to a JavaScript object
let itdvArtworkMap;
try {
  // Remove the TypeScript type annotation and export declaration
  const itdvArtworkStr = itdvArtworkMatch[1];
  itdvArtworkMap = eval('(' + itdvArtworkStr + ')');
} catch (error) {
  console.error('❌ Error parsing ITDV artwork map:', error);
  process.exit(1);
}

console.log(`🎨 Loaded ${Object.keys(itdvArtworkMap).length} ITDV artwork URLs`);

// Create a combined artwork map for easier lookup
const combinedArtworkMap = { ...hghArtworkMap, ...itdvArtworkMap };
console.log(`🎨 Combined artwork map has ${Object.keys(combinedArtworkMap).length} total URLs`);

// Function to find the best match for a track
function findArtworkMatch(track, artworkMap) {
  const trackTitle = track.title.trim();
  const trackArtist = track.artist ? track.artist.trim() : '';
  
  // Try exact title match first
  if (artworkMap[trackTitle]) {
    return artworkMap[trackTitle];
  }
  
  // Try title + artist match
  if (trackArtist) {
    const titleArtistKey = `${trackTitle} - ${trackArtist}`;
    if (artworkMap[titleArtistKey]) {
      return artworkMap[titleArtistKey];
    }
    
    // Try artist - title format
    const artistTitleKey = `${trackArtist} - ${trackTitle}`;
    if (artworkMap[artistTitleKey]) {
      return artworkMap[artistTitleKey];
    }
  }
  
  // Try partial matches (case insensitive)
  const lowerTrackTitle = trackTitle.toLowerCase();
  for (const [key, url] of Object.entries(artworkMap)) {
    if (key.toLowerCase().includes(lowerTrackTitle) || lowerTrackTitle.includes(key.toLowerCase())) {
      return url;
    }
  }
  
  return null;
}

// Track statistics
let tracksUpdated = 0;
let tracksAlreadyHadArtwork = 0;
let tracksNoMatchFound = 0;
let tracksWithNullArtwork = 0;

// Process each track
musicTracksData.musicTracks.forEach((track, index) => {
  if (track.artworkUrl && track.artworkUrl.trim() !== '') {
    tracksAlreadyHadArtwork++;
    return; // Skip tracks that already have artwork
  }
  
  if (track.artworkUrl === null) {
    tracksWithNullArtwork++;
  }
  
  // Try to find artwork for this track
  const artworkUrl = findArtworkMatch(track, combinedArtworkMap);
  
  if (artworkUrl) {
    track.artworkUrl = artworkUrl;
    tracksUpdated++;
    
    if (tracksUpdated % 100 === 0) {
      console.log(`✅ Updated ${tracksUpdated} tracks so far...`);
    }
  } else {
    tracksNoMatchFound++;
  }
});

// Save the updated database
const backupPath = path.join(__dirname, '..', 'data', `music-tracks-backup-before-artwork-merge-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(musicTracksData, null, 2));
console.log(`💾 Created backup: ${path.basename(backupPath)}`);

// Save the updated database
fs.writeFileSync(musicTracksPath, JSON.stringify(musicTracksData, null, 2));
console.log(`💾 Updated main database: ${musicTracksPath}`);

// Print summary
console.log('\n🎨 Artwork Merge Summary:');
console.log(`📊 Total tracks processed: ${musicTracksData.musicTracks.length}`);
console.log(`✅ Tracks already had artwork: ${tracksAlreadyHadArtwork}`);
console.log(`🆕 Tracks updated with artwork: ${tracksUpdated}`);
console.log(`❌ Tracks with no artwork match: ${tracksNoMatchFound}`);
console.log(`🔍 Tracks that had null artwork: ${tracksWithNullArtwork}`);

// Calculate new coverage
const totalTracks = musicTracksData.musicTracks.length;
const tracksWithArtwork = tracksAlreadyHadArtwork + tracksUpdated;
const coveragePercentage = ((tracksWithArtwork / totalTracks) * 100).toFixed(1);

console.log(`\n📈 New artwork coverage: ${tracksWithArtwork}/${totalTracks} (${coveragePercentage}%)`);

// Show some examples of updated tracks
console.log('\n🎵 Examples of tracks that got artwork:');
const updatedTracks = musicTracksData.musicTracks.filter(track => 
  track.artworkUrl && track.artworkUrl.trim() !== '' && 
  !track.artworkUrl.includes('cloudfront.net') // Exclude tracks that already had artwork
).slice(0, 5);

updatedTracks.forEach(track => {
  console.log(`  • "${track.title}" - ${track.artist} (${track.source})`);
});

console.log('\n✨ Artwork merge completed successfully!');
