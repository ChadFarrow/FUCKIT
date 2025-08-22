#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const MUSIC_TRACKS_PATH = path.join(__dirname, '../data/music-tracks.json');
const REPORT_PATH = path.join(__dirname, '../data/final-database-validation-report.json');

async function main() {
  console.log('🔍 Final Database Validation & Health Check');
  console.log('=' .repeat(50));
  console.log('');
  
  try {
    // Read music tracks
    const musicData = JSON.parse(fs.readFileSync(MUSIC_TRACKS_PATH, 'utf-8'));
    const musicTracks = musicData.musicTracks || musicData;
    
    console.log(`📀 Database Overview:`);
    console.log(`   Total tracks: ${musicTracks.length}`);
    console.log(`   File size: ${(fs.statSync(MUSIC_TRACKS_PATH).size / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    
    // 1. Metadata Coverage Analysis
    console.log('📊 Metadata Coverage Analysis:');
    console.log('-'.repeat(30));
    
    const coverage = {
      audioUrl: musicTracks.filter(t => t.audioUrl && t.audioUrl.trim()).length,
      duration: musicTracks.filter(t => t.duration && t.duration.trim()).length,
      imageUrl: musicTracks.filter(t => t.imageUrl && t.imageUrl.trim()).length,
      publisher: musicTracks.filter(t => t.publisher && t.publisher.trim()).length,
      artist: musicTracks.filter(t => t.artist && t.artist.trim()).length,
      title: musicTracks.filter(t => t.title && t.title.trim()).length,
      feedUrl: musicTracks.filter(t => t.feedUrl && t.feedUrl.trim()).length,
      itemGuid: musicTracks.filter(t => t.itemGuid && (t.itemGuid._ || t.itemGuid)).length,
      feedGuid: musicTracks.filter(t => t.feedGuid && t.feedGuid.trim()).length
    };
    
    console.log(`   🎵 Audio URLs: ${coverage.audioUrl}/${musicTracks.length} (${(coverage.audioUrl/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   ⏱️  Durations: ${coverage.duration}/${musicTracks.length} (${(coverage.duration/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   🖼️  Artwork: ${coverage.imageUrl}/${musicTracks.length} (${(coverage.imageUrl/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   👤 Publishers: ${coverage.publisher}/${musicTracks.length} (${(coverage.publisher/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   🎨 Artists: ${coverage.artist}/${musicTracks.length} (${(coverage.artist/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   📝 Titles: ${coverage.title}/${musicTracks.length} (${(coverage.title/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   🔗 Feed URLs: ${coverage.feedUrl}/${musicTracks.length} (${(coverage.feedUrl/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   🆔 Item GUIDs: ${coverage.itemGuid}/${musicTracks.length} (${(coverage.itemGuid/musicTracks.length*100).toFixed(1)}%)`);
    console.log(`   🆔 Feed GUIDs: ${coverage.feedGuid}/${musicTracks.length} (${(coverage.feedGuid/musicTracks.length*100).toFixed(1)}%)`);
    console.log('');
    
    // 2. Data Quality Issues
    console.log('⚠️  Data Quality Issues:');
    console.log('-'.repeat(30));
    
    const issues = {
      noAudio: musicTracks.filter(t => !t.audioUrl || !t.audioUrl.trim()),
      noDuration: musicTracks.filter(t => !t.duration || !t.duration.trim()),
      noArtwork: musicTracks.filter(t => !t.imageUrl || !t.imageUrl.trim()),
      noPublisher: musicTracks.filter(t => !t.publisher || !t.publisher.trim()),
      noArtist: musicTracks.filter(t => !t.artist || !t.artist.trim()),
      noTitle: musicTracks.filter(t => !t.title || !t.title.trim()),
      noFeedUrl: musicTracks.filter(t => !t.feedUrl || !t.feedUrl.trim()),
      noItemGuid: musicTracks.filter(t => !t.itemGuid || (!t.itemGuid._ && !t.itemGuid)),
      noFeedGuid: musicTracks.filter(t => !t.feedGuid || !t.feedGuid.trim())
    };
    
    console.log(`   ❌ No audio URL: ${issues.noAudio.length} tracks`);
    console.log(`   ❌ No duration: ${issues.noDuration.length} tracks`);
    console.log(`   ❌ No artwork: ${issues.noArtwork.length} tracks`);
    console.log(`   ❌ No publisher: ${issues.noPublisher.length} tracks`);
    console.log(`   ❌ No artist: ${issues.noArtist.length} tracks`);
    console.log(`   ❌ No title: ${issues.noTitle.length} tracks`);
    console.log(`   ❌ No feed URL: ${issues.noFeedUrl.length} tracks`);
    console.log(`   ❌ No item GUID: ${issues.noItemGuid.length} tracks`);
    console.log(`   ❌ No feed GUID: ${issues.noFeedGuid.length} tracks`);
    console.log('');
    
    // 3. Feed Source Analysis
    console.log('🔗 Feed Source Analysis:');
    console.log('-'.repeat(30));
    
    const feedDomains = {};
    musicTracks.forEach(track => {
      if (track.feedUrl) {
        try {
          const domain = new URL(track.feedUrl).hostname;
          feedDomains[domain] = (feedDomains[domain] || 0) + 1;
        } catch (e) {
          // Invalid URL
        }
      }
    });
    
    const sortedDomains = Object.entries(feedDomains)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    console.log(`   Top feed sources:`);
    sortedDomains.forEach(([domain, count]) => {
      console.log(`     ${domain}: ${count} tracks`);
    });
    console.log('');
    
    // 4. Publisher Analysis
    console.log('👤 Publisher Analysis:');
    console.log('-'.repeat(30));
    
    const publishers = {};
    musicTracks.forEach(track => {
      if (track.publisher && track.publisher.trim()) {
        publishers[track.publisher] = (publishers[track.publisher] || 0) + 1;
      }
    });
    
    const sortedPublishers = Object.entries(publishers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15);
    
    console.log(`   Top publishers:`);
    sortedPublishers.forEach(([publisher, count]) => {
      console.log(`     ${publisher}: ${count} tracks`);
    });
    console.log('');
    
    // 5. Sample Issues for Manual Review
    console.log('🔍 Sample Issues for Manual Review:');
    console.log('-'.repeat(30));
    
    if (issues.noAudio.length > 0) {
      console.log(`   📋 Sample tracks without audio URLs:`);
      issues.noAudio.slice(0, 5).forEach((track, i) => {
        console.log(`     ${i + 1}. ${track.title} (${track.artist || 'Unknown Artist'}) - Publisher: ${track.publisher || 'Unknown'}`);
      });
      if (issues.noAudio.length > 5) {
        console.log(`     ... and ${issues.noAudio.length - 5} more`);
      }
      console.log('');
    }
    
    if (issues.noPublisher.length > 0) {
      console.log(`   📋 Sample tracks without publishers:`);
      issues.noPublisher.slice(0, 5).forEach((track, i) => {
        console.log(`     ${i + 1}. ${track.title} (${track.artist || 'Unknown Artist'})`);
      });
      if (issues.noPublisher.length > 5) {
        console.log(`     ... and ${issues.noPublisher.length - 5} more`);
      }
      console.log('');
    }
    
    // 6. Overall Health Score
    console.log('🏥 Overall Database Health Score:');
    console.log('-'.repeat(30));
    
    const criticalFields = ['audioUrl', 'duration', 'imageUrl', 'publisher', 'artist', 'title'];
    const healthScores = criticalFields.map(field => {
      const count = musicTracks.filter(t => t[field] && t[field].trim()).length;
      return (count / musicTracks.length) * 100;
    });
    
    const overallHealth = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
    
    console.log(`   📊 Overall Health: ${overallHealth.toFixed(1)}%`);
    console.log(`   🎯 Target: 95%+ (Excellent)`);
    console.log(`   📈 Status: ${overallHealth >= 95 ? '🟢 Excellent' : overallHealth >= 80 ? '🟡 Good' : overallHealth >= 60 ? '🟠 Fair' : '🔴 Poor'}`);
    console.log('');
    
    // 7. Recommendations
    console.log('💡 Recommendations:');
    console.log('-'.repeat(30));
    
    if (issues.noAudio.length > 0) {
      console.log(`   🎵 ${issues.noAudio.length} tracks missing audio URLs - Consider re-running Wavlake resolution`);
    }
    
    if (issues.noPublisher.length > 0) {
      console.log(`   👤 ${issues.noPublisher.length} tracks missing publishers - May need manual review`);
    }
    
    if (overallHealth >= 95) {
      console.log(`   ✅ Database is in excellent condition! No major issues detected.`);
    } else if (overallHealth >= 80) {
      console.log(`   ⚠️  Database is in good condition with minor issues that could be addressed.`);
    } else {
      console.log(`   🔴 Database has significant issues that should be addressed.`);
    }
    
    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTracks: musicTracks.length,
        fileSizeMB: (fs.statSync(MUSIC_TRACKS_PATH).size / 1024 / 1024).toFixed(2),
        overallHealth: overallHealth.toFixed(1)
      },
      coverage: coverage,
      issues: {
        noAudio: issues.noAudio.length,
        noDuration: issues.noDuration.length,
        noArtwork: issues.noArtwork.length,
        noPublisher: issues.noPublisher.length,
        noArtist: issues.noArtist.length,
        noTitle: issues.noTitle.length,
        noFeedUrl: issues.noFeedUrl.length,
        noItemGuid: issues.noItemGuid.length,
        noFeedGuid: issues.noFeedGuid.length
      },
      feedSources: feedDomains,
      topPublishers: Object.fromEntries(sortedPublishers),
      sampleIssues: {
        noAudio: issues.noAudio.slice(0, 10).map(t => ({ title: t.title, artist: t.artist, publisher: t.publisher })),
        noPublisher: issues.noPublisher.slice(0, 10).map(t => ({ title: t.title, artist: t.artist }))
      },
      recommendations: []
    };
    
    if (issues.noAudio.length > 0) {
      report.recommendations.push(`Re-run Wavlake resolution for ${issues.noAudio.length} tracks missing audio URLs`);
    }
    if (issues.noPublisher.length > 0) {
      report.recommendations.push(`Manual review needed for ${issues.noPublisher.length} tracks missing publishers`);
    }
    if (overallHealth >= 95) {
      report.recommendations.push('Database is in excellent condition - no major issues detected');
    }
    
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    
    console.log(`💾 Comprehensive report saved to: ${REPORT_PATH}`);
    console.log('');
    console.log('🎉 Final Database Validation Complete!');
    
  } catch (error) {
    console.error('❌ Error during validation:', error.message);
  }
}

main();
