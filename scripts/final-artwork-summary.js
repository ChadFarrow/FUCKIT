#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📊 Final Artwork Coverage Report\n');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

let withRealArtwork = 0;
let withPlaceholder = 0;
let completelyMissing = 0;
let totalAlbums = 0;

const stillMissing = [];

parsedFeedsData.feeds.forEach(feed => {
  const album = feed.parsedData?.album;
  if (!album) return;
  
  totalAlbums++;
  
  if (!album.coverArt || album.coverArt === '') {
    completelyMissing++;
    stillMissing.push({
      id: feed.id,
      title: album.title,
      artist: album.artist
    });
  } else if (album.coverArt.includes('placeholder') || album.coverArt.includes('kolomona.com')) {
    withPlaceholder++;
  } else {
    withRealArtwork++;
  }
});

console.log('🎨 Artwork Status Summary:');
console.log('=' .repeat(40));
console.log(`📁 Total albums: ${totalAlbums}`);
console.log(`✅ Real artwork: ${withRealArtwork} (${(withRealArtwork/totalAlbums*100).toFixed(1)}%)`);
console.log(`🎨 Placeholder: ${withPlaceholder} (${(withPlaceholder/totalAlbums*100).toFixed(1)}%)`);
console.log(`❌ Missing: ${completelyMissing} (${(completelyMissing/totalAlbums*100).toFixed(1)}%)`);

const coverageWithPlaceholder = ((withRealArtwork + withPlaceholder) / totalAlbums * 100).toFixed(1);
console.log(`\n📈 Visual Coverage: ${coverageWithPlaceholder}% (including placeholders)`);

if (stillMissing.length > 0) {
  console.log(`\n❌ Albums still completely missing artwork (${stillMissing.length}):`);
  stillMissing.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.title} (${item.id})`);
  });
}

console.log('\n✅ Database artwork search complete!');

// Save final report
const reportPath = path.join(__dirname, '..', 'data', `final-artwork-report-${Date.now()}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  summary: {
    totalAlbums,
    withRealArtwork,
    withPlaceholder,
    completelyMissing,
    coveragePercentage: parseFloat(coverageWithPlaceholder)
  },
  stillMissing
}, null, 2));

console.log(`💾 Final report saved to: ${path.basename(reportPath)}`);