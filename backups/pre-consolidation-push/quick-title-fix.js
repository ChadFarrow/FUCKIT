const fs = require('fs');

// Load current data
const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');

// Extract all resolved titles from audio URLs
const resolvedTitles = [];
const audioMatch = audioModule.match(/"([^"]+)":\s*"[^"]+"/g);
if (audioMatch) {
  audioMatch.forEach(entry => {
    const [, title] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
    if (!title.startsWith('Track ') && title !== 'Unknown Title') {
      resolvedTitles.push(title);
    }
  });
}

console.log('🔧 Quick Fix: Update Track Titles');
console.log('=' .repeat(40));
console.log(`Found ${resolvedTitles.length} resolved titles in audio URLs`);
console.log(`Found ${hghSongs.filter(t => t.title.startsWith('Track ')).length} placeholder titles`);

// The real issue: we have resolved audio URLs but the track titles weren't updated
// This means we need to run the direct RSS resolution again with the bug fixed
// For now, let's show what we have:

console.log('\n📋 Sample resolved titles available:');
resolvedTitles.slice(0, 10).forEach(title => console.log(`  ✅ "${title}"`));

console.log('\n📋 Sample placeholder titles still needing resolution:');
hghSongs.filter(t => t.title.startsWith('Track ')).slice(0, 10).forEach(track => {
  console.log(`  ❓ "${track.title}" (GUID: ${track.itemGuid})`);
});

console.log('\n💡 SOLUTION:');
console.log('The direct RSS resolution script successfully resolved tracks but failed to save the titles.');
console.log('We have ~305 working audio URLs but the titles still show "Track X".');
console.log('We need to either:');
console.log('1. Fix the direct RSS script and re-run it (recommended)');  
console.log('2. Create a mapping script to match GUIDs to resolved titles');
console.log('\n🎯 Current status: ~95% functional (audio works) but UI shows placeholder names');