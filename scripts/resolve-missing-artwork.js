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

// Parse the songs
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

console.log(`🎨 Resolving artwork for ${songs.length} tracks...`);
console.log(`Current artwork map: ${Object.keys(artworkMap).length} entries\n`);

// Generate potential artwork URLs based on patterns we see
function generateArtworkCandidates(song) {
  const candidates = [];
  const title = song.title;
  const artist = song.artist;
  const feedUrl = song.feedUrl || '';
  const feedTitle = song.feedTitle || '';

  // Direct feedUrl analysis for artwork patterns
  if (feedUrl.includes('heycitizen.xyz')) {
    // HeyCitizen artwork patterns
    const titleForUrl = title.toLowerCase()
      .replace(/[\s\(\)\[\]'!,\.]/g, '')
      .replace(/\s+/g, '');
    
    if (feedUrl.includes('Lofi-Experience')) {
      candidates.push(`https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi-${titleForUrl}.jpg`);
    } else if (feedUrl.includes('The-Heycitizen-Experience')) {
      candidates.push(`https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/${titleForUrl.charAt(0).toUpperCase() + titleForUrl.slice(1)}.jpg`);
    }
  }

  if (feedUrl.includes('doerfelverse.com')) {
    // Doerfelverse artwork patterns
    const titleForUrl = title.toLowerCase()
      .replace(/[\s\(\)\[\]'!,\.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    candidates.push(`https://www.doerfelverse.com/art/${titleForUrl}.jpg`);
    candidates.push(`https://www.doerfelverse.com/art/${titleForUrl}.png`);
    
    // Artist-specific paths
    if (artist.toLowerCase().includes('doerfel')) {
      candidates.push(`https://www.doerfelverse.com/artists/doerfels/${titleForUrl}.jpg`);
    }
  }

  if (feedUrl.includes('thisisjdog.com')) {
    // Jdog artwork patterns
    const titleForUrl = title.toLowerCase()
      .replace(/[\s\(\)\[\]'!,\.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    candidates.push(`https://www.thisisjdog.com/media/${titleForUrl}.jpg`);
    candidates.push(`https://www.thisisjdog.com/art/${titleForUrl}.jpg`);
  }

  if (feedUrl.includes('wavlake.com')) {
    // Wavlake tracks might have artwork in their RSS
    // For now, we'll skip these as they need RSS parsing
  }

  if (feedUrl.includes('jimmyv4v.com')) {
    // Jimmy V artwork patterns
    const titleForUrl = title.toLowerCase()
      .replace(/[\s\(\)\[\]'!,\.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    candidates.push(`https://music.jimmyv4v.com/bands/jimmy-v/artwork/${titleForUrl}.jpg`);
    candidates.push(`https://music.jimmyv4v.com/bands/jimmy-v/jimmy-v-collection/${titleForUrl}.jpg`);
  }

  return candidates;
}

async function testArtworkUrl(url) {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'User-Agent': 'FUCKIT-Artwork-Resolver/1.0'
      }
    });
    return response.ok && response.headers.get('content-type')?.startsWith('image/');
  } catch (error) {
    return false;
  }
}

async function resolveArtwork() {
  const newArtwork = {};
  const failed = [];
  
  // Only check tracks that don't already have artwork
  const tracksNeedingArtwork = songs.filter(song => !artworkMap[song.title]);
  
  console.log(`🔍 Testing artwork for ${tracksNeedingArtwork.length} tracks without custom art...\n`);
  
  for (const song of tracksNeedingArtwork.slice(0, 30)) { // Test first 30
    console.log(`Testing: "${song.title}" by ${song.artist}`);
    const candidates = generateArtworkCandidates(song);
    
    let found = false;
    for (const candidate of candidates) {
      if (await testArtworkUrl(candidate)) {
        console.log(`  ✅ Found: ${candidate}`);
        newArtwork[song.title] = candidate;
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log(`  ❌ No artwork found (tested ${candidates.length} URLs)`);
      failed.push(song.title);
    }
    
    // Be respectful with requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n📊 Results:`);
  console.log(`✅ New artwork found: ${Object.keys(newArtwork).length}`);
  console.log(`❌ Still missing: ${failed.length}`);
  
  if (Object.keys(newArtwork).length > 0) {
    console.log(`\n🎨 New artwork entries to add:\n`);
    for (const [title, url] of Object.entries(newArtwork)) {
      console.log(`  "${title}": "${url}",`);
    }
    
    console.log(`\n💡 Add these entries to ARTWORK_URL_MAP in ITDVPlaylistAlbum.tsx`);
  }
  
  return newArtwork;
}

resolveArtwork().catch(console.error);