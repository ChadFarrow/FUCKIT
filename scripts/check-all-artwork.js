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

console.log(`Found ${songs.length} songs to check`);
console.log(`Current artwork map has ${Object.keys(artworkMap).length} entries\n`);

// Check each song
const withArtwork = [];
const withoutArtwork = [];

for (const song of songs) {
  if (artworkMap[song.title]) {
    withArtwork.push({
      title: song.title,
      artist: song.artist,
      artwork: artworkMap[song.title]
    });
  } else {
    withoutArtwork.push({
      title: song.title,
      artist: song.artist,
      defaultArt: 'https://www.doerfelverse.com/art/itdvchadf.png'
    });
  }
}

console.log('📊 ARTWORK SUMMARY:');
console.log(`✅ With custom artwork: ${withArtwork.length}`);
console.log(`❌ Using default/placeholder: ${withoutArtwork.length}`);
console.log(`📈 Coverage: ${Math.round((withArtwork.length / songs.length) * 100)}%\n`);

console.log('🖼️  TRACKS USING DEFAULT ARTWORK (may show as placeholders):');
withoutArtwork.slice(0, 30).forEach((track, i) => {
  console.log(`${i+1}. "${track.title}" by ${track.artist}`);
});

if (withoutArtwork.length > 30) {
  console.log(`   ... and ${withoutArtwork.length - 30} more`);
}