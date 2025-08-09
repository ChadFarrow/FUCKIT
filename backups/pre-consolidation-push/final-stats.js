const fs = require('fs');

const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');

const audioTitles = new Set();
const audioMatch = audioModule.match(/"([^"]+)":\s*"[^"]+"/g);
if (audioMatch) {
  audioMatch.forEach(entry => {
    const [, title] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
    audioTitles.add(title);
  });
}

const placeholders = hghSongs.filter(t => t.title.startsWith('Track ')).length;
const unknownFeeds = hghSongs.filter(t => t.title === 'Unknown Feed').length;
const resolved = hghSongs.filter(t => !t.title.startsWith('Track ') && t.title !== 'Unknown Feed').length;

console.log('📊 FINAL HGH PLAYLIST STATUS:');
console.log('===============================');
console.log(`Total tracks: ${hghSongs.length}`);
console.log(`Working audio URLs: ${audioTitles.size}`);
console.log(`Success rate: ${((audioTitles.size / hghSongs.length) * 100).toFixed(1)}%`);
console.log('');
console.log('Track breakdown:');
console.log(`✅ Fully resolved: ${resolved} tracks`);
console.log(`❓ Placeholder tracks: ${placeholders} tracks`);
console.log(`❌ Unknown/corrupted feeds: ${unknownFeeds} tracks`);
console.log('');
console.log(`🎯 Theoretical max success rate: ${(((audioTitles.size + placeholders) / hghSongs.length) * 100).toFixed(1)}% if all placeholders were resolvable`);