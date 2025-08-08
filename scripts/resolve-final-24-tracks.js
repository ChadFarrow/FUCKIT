#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the ITDVPlaylistAlbum.tsx file
const componentPath = path.join(__dirname, '../components/ITDVPlaylistAlbum.tsx');
const componentContent = fs.readFileSync(componentPath, 'utf8');

// Extract RESOLVED_SONGS array
const startIndex = componentContent.indexOf('const RESOLVED_SONGS = [');
const endIndex = componentContent.indexOf('].filter(song => song.title');
const songsArrayStr = componentContent.substring(startIndex, endIndex + 1)
  .replace('const RESOLVED_SONGS = [', '[');

let songs;
try {
  eval('songs = ' + songsArrayStr);
} catch (error) {
  console.error('Error parsing songs:', error);
  process.exit(1);
}

// Extract current ARTWORK_URL_MAP
const artworkStartIndex = componentContent.indexOf('const ARTWORK_URL_MAP: { [key: string]: string } = {');
const artworkEndIndex = componentContent.indexOf('};', artworkStartIndex) + 2;
const artworkMapStr = componentContent.substring(artworkStartIndex, artworkEndIndex)
  .replace('const ARTWORK_URL_MAP: { [key: string]: string } = ', '');

let artworkMap;
try {
  eval('artworkMap = ' + artworkMapStr);
} catch (error) {
  console.error('Error parsing artwork map:', error);
  process.exit(1);
}

// Find the exact 24 tracks still missing artwork
const missing24Tracks = [
  "Bullet Train",
  "Mrs Valentine", 
  "I Believe",
  "This Pain I've Grown",
  "A Sight To See Remix",
  "All Apology (EP track)",
  "St. Joan",
  "Bringing Em Down", 
  "Calibrating Broadcast​.​.​.",
  "Radio Brigade",
  "Hello Stranger feat. Helen Tess",
  "A Chemical to Balance",
  "Bad People",
  "The Poet Barfly - Demo",
  "I Do It Cuz It's Bad",
  "Beer Run",
  "Midnight Comin'",
  "Railroad Tracks",
  "Wonder Woman",
  "What's Your New Love Like",
  "That's the Life",
  "Change Your Mind",
  "That Duck",
  "Hallucinations"
];

console.log(`🎯 Targeting the final 24 tracks without artwork\n`);

// Get the song objects for these tracks
const targetSongs = missing24Tracks.map(title => {
  return songs.find(song => song.title === title);
}).filter(Boolean);

console.log(`Found ${targetSongs.length} target songs in data\n`);

async function getFeedArtwork(feedUrl) {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'FUCKIT-Final-Artwork-Resolver/1.0' }
    });
    
    if (!response.ok) {
      console.log(`  ❌ HTTP ${response.status}`);
      return null;
    }
    
    const xmlText = await response.text();
    
    // Look for iTunes image tag
    const iTunesImageMatch = xmlText.match(/<itunes:image[^>]*href="([^"]+)"/i);
    if (iTunesImageMatch) {
      return iTunesImageMatch[1];
    }
    
    // Look for regular image tag
    const imageMatch = xmlText.match(/<image[^>]*><url>([^<]+)<\/url>/i) ||
                      xmlText.match(/<url>([^<]+)<\/url>/i);
    if (imageMatch) {
      return imageMatch[1];
    }
    
    return null;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function resolveRemainingArtwork() {
  console.log('🔍 Resolving artwork for the final 24 tracks...\n');
  
  const newArtwork = {};
  let resolved = 0;
  let failed = 0;
  
  for (const song of targetSongs) {
    console.log(`🎵 "${song.title}" by ${song.artist}`);
    console.log(`   Feed: ${song.feedUrl}`);
    
    const artwork = await getFeedArtwork(song.feedUrl);
    if (artwork) {
      newArtwork[song.title] = artwork;
      resolved++;
      console.log(`   ✅ Found: ${artwork}\n`);
    } else {
      failed++;
      console.log(`   ❌ No artwork found\n`);
    }
    
    // Be respectful with requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n📊 Final Results:`);
  console.log(`✅ Resolved: ${resolved}/24`);
  console.log(`❌ Failed: ${failed}/24`);
  
  if (resolved > 0) {
    console.log(`\n🎨 New artwork entries to add:\n`);
    for (const [title, url] of Object.entries(newArtwork)) {
      console.log(`  "${title}": "${url}",`);
    }
    
    const totalPotential = Object.keys(artworkMap).length + resolved;
    console.log(`\n📈 Potential total coverage: ${totalPotential}/111 tracks (${Math.round((totalPotential/111) * 100)}%)`);
  }
  
  return newArtwork;
}

resolveRemainingArtwork().catch(console.error);