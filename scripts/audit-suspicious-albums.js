#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Auditing suspicious albums with podcast-related artwork...\n');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Patterns that indicate podcast platform artwork (not music)
const suspiciousArtworkPatterns = [
  'podbean.com',
  'libsyn.com',
  'megaphone.imgix.net',
  'himalaya.com',
  'fusebox.fm',
  'buzzsprout.com',
  'spreaker.com',
  'podcastone.com',
  'podcasts.apple.com',
  'podcast_banner',
  'podcast-logo',
  'good-morning-america'
];

// Check each album
const suspiciousAlbums = [];

parsedFeedsData.feeds.forEach(feed => {
  if (!feed.parsedData || !feed.parsedData.album) return;
  
  const album = feed.parsedData.album;
  const artwork = album.coverArt || '';
  
  // Check if artwork URL contains suspicious patterns
  const hasSuspiciousArtwork = suspiciousArtworkPatterns.some(pattern => 
    artwork.toLowerCase().includes(pattern)
  );
  
  if (hasSuspiciousArtwork) {
    // Analyze track titles to determine if it's legitimate music
    const tracks = album.tracks || [];
    const genericTrackCount = tracks.filter(t => 
      t.title.match(/^Track \d+$/) || 
      t.title.match(/^Episode \d+$/) ||
      t.title.match(/^Chapter \d+$/)
    ).length;
    
    const inappropriateTrackCount = tracks.filter(t => {
      const title = t.title.toLowerCase();
      return title.includes('pussy') || 
             title.includes('fuck') || 
             title.includes('shit') ||
             title.includes('ass') ||
             title.includes('episode') ||
             title.includes('interview') ||
             title.includes('podcast');
    }).length;
    
    suspiciousAlbums.push({
      id: feed.id,
      title: album.title,
      artist: album.artist,
      artwork: artwork,
      trackCount: tracks.length,
      genericTrackCount: genericTrackCount,
      inappropriateTrackCount: inappropriateTrackCount,
      sampleTracks: tracks.slice(0, 3).map(t => t.title),
      feedGuid: album.feedGuid,
      likely: inappropriateTrackCount > 0 || genericTrackCount > tracks.length / 2 
        ? 'NOT_MUSIC' 
        : 'MUSIC_WITH_WRONG_ART'
    });
  }
});

// Display results
console.log(`Found ${suspiciousAlbums.length} albums with suspicious artwork:\n`);

suspiciousAlbums.forEach((album, index) => {
  console.log(`${index + 1}. ${album.title} by ${album.artist}`);
  console.log(`   ID: ${album.id}`);
  console.log(`   Artwork: ${album.artwork.substring(0, 80)}...`);
  console.log(`   Tracks: ${album.trackCount} total, ${album.genericTrackCount} generic, ${album.inappropriateTrackCount} inappropriate`);
  console.log(`   Sample tracks: ${album.sampleTracks.join(', ')}`);
  console.log(`   Assessment: ${album.likely}`);
  console.log('');
});

// Summary
const notMusic = suspiciousAlbums.filter(a => a.likely === 'NOT_MUSIC');
const wrongArt = suspiciousAlbums.filter(a => a.likely === 'MUSIC_WITH_WRONG_ART');

console.log('=' .repeat(60));
console.log('SUMMARY:');
console.log(`• Albums that are NOT music: ${notMusic.length}`);
console.log(`• Music albums with wrong artwork: ${wrongArt.length}`);

// List albums to remove
if (notMusic.length > 0) {
  console.log('\n🗑️  Albums that should be REMOVED:');
  notMusic.forEach(album => {
    console.log(`   - ${album.title} (${album.id})`);
  });
}

// List albums needing artwork fix
if (wrongArt.length > 0) {
  console.log('\n🎨 Albums needing ARTWORK FIX:');
  wrongArt.forEach(album => {
    console.log(`   - ${album.title} (${album.id})`);
  });
}

// Save audit report
const reportPath = path.join(__dirname, '..', 'data', `album-audit-report-${Date.now()}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalSuspicious: suspiciousAlbums.length,
  notMusic: notMusic,
  wrongArt: wrongArt,
  allSuspicious: suspiciousAlbums
}, null, 2));

console.log(`\n💾 Audit report saved to: ${path.basename(reportPath)}`);