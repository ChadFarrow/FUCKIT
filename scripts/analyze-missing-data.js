#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing database for missing information...\n');

// Load parsed feeds data
const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));

// Analyze missing data
const analysis = {
  totalFeeds: parsedFeedsData.feeds.length,
  missingArtwork: [],
  placeholderArtwork: [],
  missingFeedGuid: [],
  missingTracks: [],
  emptyTracks: [],
  missingPublisher: [],
  failedParses: [],
  missingDurations: []
};

parsedFeedsData.feeds.forEach(feed => {
  const album = feed.parsedData?.album;
  
  if (!album) {
    analysis.failedParses.push({
      id: feed.id,
      title: feed.title || 'Unknown',
      url: feed.originalUrl
    });
    return;
  }
  
  // Check for missing or placeholder artwork
  if (!album.coverArt || album.coverArt === '') {
    analysis.missingArtwork.push({
      id: feed.id,
      title: album.title,
      artist: album.artist
    });
  } else if (album.coverArt.includes('placeholder') || album.coverArt.includes('kolomona.com')) {
    analysis.placeholderArtwork.push({
      id: feed.id,
      title: album.title,
      artist: album.artist,
      currentArt: album.coverArt
    });
  }
  
  // Check for missing feed GUID
  if (!album.feedGuid || album.feedGuid === '') {
    analysis.missingFeedGuid.push({
      id: feed.id,
      title: album.title,
      artist: album.artist
    });
  }
  
  // Check for empty tracks
  if (!album.tracks || album.tracks.length === 0) {
    analysis.emptyTracks.push({
      id: feed.id,
      title: album.title,
      artist: album.artist
    });
  }
  
  // Check for missing track URLs
  if (album.tracks) {
    const tracksWithoutUrls = album.tracks.filter(t => !t.url || t.url === '');
    if (tracksWithoutUrls.length > 0) {
      analysis.missingTracks.push({
        id: feed.id,
        title: album.title,
        missingCount: tracksWithoutUrls.length,
        totalTracks: album.tracks.length
      });
    }
    
    // Check for missing durations
    const tracksWithoutDuration = album.tracks.filter(t => 
      !t.duration || t.duration === '0:00' || t.duration === '0'
    );
    if (tracksWithoutDuration.length > 0) {
      analysis.missingDurations.push({
        id: feed.id,
        title: album.title,
        missingCount: tracksWithoutDuration.length,
        totalTracks: album.tracks.length
      });
    }
  }
  
  // Check for missing publisher info
  if (!album.publisher || !album.publisher.name) {
    analysis.missingPublisher.push({
      id: feed.id,
      title: album.title,
      artist: album.artist
    });
  }
});

// Display analysis results
console.log('📊 Database Analysis Report');
console.log('=' .repeat(50));
console.log(`Total feeds: ${analysis.totalFeeds}\n`);

console.log('🎨 Artwork Issues:');
console.log(`   • Missing artwork: ${analysis.missingArtwork.length}`);
console.log(`   • Placeholder artwork: ${analysis.placeholderArtwork.length}`);
if (analysis.placeholderArtwork.length > 0) {
  console.log('   Examples:');
  analysis.placeholderArtwork.slice(0, 5).forEach(item => {
    console.log(`     - ${item.title} (${item.id})`);
  });
}

console.log('\n🆔 Feed GUID Issues:');
console.log(`   • Missing feed GUID: ${analysis.missingFeedGuid.length}`);
if (analysis.missingFeedGuid.length > 0) {
  console.log('   Examples:');
  analysis.missingFeedGuid.slice(0, 5).forEach(item => {
    console.log(`     - ${item.title} (${item.id})`);
  });
}

console.log('\n🎵 Track Issues:');
console.log(`   • Albums with no tracks: ${analysis.emptyTracks.length}`);
console.log(`   • Albums with missing track URLs: ${analysis.missingTracks.length}`);
console.log(`   • Albums with missing durations: ${analysis.missingDurations.length}`);
if (analysis.missingTracks.length > 0) {
  console.log('   Missing URLs:');
  analysis.missingTracks.slice(0, 5).forEach(item => {
    console.log(`     - ${item.title}: ${item.missingCount}/${item.totalTracks} tracks`);
  });
}

console.log('\n🏢 Publisher Issues:');
console.log(`   • Missing publisher info: ${analysis.missingPublisher.length}`);

console.log('\n❌ Parse Failures:');
console.log(`   • Failed to parse: ${analysis.failedParses.length}`);

// Create priority list for fixes
const priorityFixes = [];

// High priority: Albums with placeholder artwork (visible to users)
if (analysis.placeholderArtwork.length > 0) {
  priorityFixes.push({
    type: 'artwork',
    priority: 'HIGH',
    count: analysis.placeholderArtwork.length,
    items: analysis.placeholderArtwork
  });
}

// Medium priority: Missing feed GUIDs (needed for PodcastIndex lookups)
if (analysis.missingFeedGuid.length > 0) {
  priorityFixes.push({
    type: 'feedGuid',
    priority: 'MEDIUM',
    count: analysis.missingFeedGuid.length,
    items: analysis.missingFeedGuid
  });
}

// Low priority: Missing track URLs (HGH tracks don't have direct URLs)
if (analysis.missingTracks.length > 0 && analysis.missingTracks.some(t => !t.id.startsWith('hgh-'))) {
  const nonHghMissing = analysis.missingTracks.filter(t => !t.id.startsWith('hgh-'));
  priorityFixes.push({
    type: 'trackUrls',
    priority: 'LOW',
    count: nonHghMissing.length,
    items: nonHghMissing
  });
}

console.log('\n🎯 Priority Fixes Needed:');
console.log('=' .repeat(50));
priorityFixes.forEach(fix => {
  console.log(`\n${fix.priority} Priority: Fix ${fix.type}`);
  console.log(`   • ${fix.count} items need fixing`);
});

// Save detailed report
const reportPath = path.join(__dirname, '..', 'data', `missing-data-analysis-${Date.now()}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  analysis: analysis,
  priorityFixes: priorityFixes
}, null, 2));

console.log(`\n💾 Detailed report saved to: ${path.basename(reportPath)}`);

// Export IDs for next step
const feedsNeedingArtwork = analysis.placeholderArtwork.map(a => ({
  id: a.id,
  title: a.title,
  artist: a.artist
}));

const feedsNeedingGuid = analysis.missingFeedGuid.map(a => ({
  id: a.id,
  title: a.title,
  artist: a.artist
}));

const exportPath = path.join(__dirname, '..', 'data', 'feeds-needing-fixes.json');
fs.writeFileSync(exportPath, JSON.stringify({
  needingArtwork: feedsNeedingArtwork,
  needingGuid: feedsNeedingGuid
}, null, 2));

console.log(`💾 Export for PodcastIndex search: ${path.basename(exportPath)}`);