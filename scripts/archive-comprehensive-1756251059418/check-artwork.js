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

console.log(`Found ${songs.length} songs total\n`);

// List first 30 tracks to see which ones might be showing placeholders
console.log('🔍 FIRST 30 TRACKS (check for placeholder images):');
songs.slice(0, 30).forEach((song, i) => {
  console.log(`${i+1}. "${song.title}" by ${song.artist}`);
});

console.log('\n💡 Check these tracks in the UI for placeholder/generic images');
console.log('The ones showing placeholder thumbnails need artwork entries added');