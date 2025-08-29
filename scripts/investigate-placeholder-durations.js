#!/usr/bin/env node

/**
 * Investigate tracks with 180-second placeholder durations
 */

const fs = require('fs');
const path = require('path');

async function investigatePlaceholderDurations() {
    console.log('🔍 Investigating 180-second placeholder durations...\n');
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Find tracks with 180-second durations
    const placeholderTracks = musicData.musicTracks.filter(track => track.duration === 180);
    
    console.log(`📊 Found ${placeholderTracks.length} tracks with 180-second durations\n`);
    
    // Group by feed to understand patterns
    const feedGroups = {};
    placeholderTracks.forEach(track => {
        const feedKey = track.feedTitle || 'Unknown';
        if (!feedGroups[feedKey]) feedGroups[feedKey] = [];
        feedGroups[feedKey].push(track);
    });
    
    console.log('📋 Tracks with placeholder durations by feed:');
    Object.entries(feedGroups).forEach(([feedTitle, tracks]) => {
        console.log(`\n🎵 "${feedTitle}" (${tracks.length} tracks)`);
        console.log(`   Feed URL: ${tracks[0].feedUrl}`);
        tracks.slice(0, 5).forEach(track => {
            console.log(`   - "${track.title}" (Audio: ${track.enclosureUrl ? 'Yes' : 'No'})`);
        });
        if (tracks.length > 5) {
            console.log(`   ... and ${tracks.length - 5} more`);
        }
    });
    
    console.log(`\n🔍 Detailed analysis of placeholder tracks:\n`);
    
    // Analyze which feeds might need duration updates
    const feedsWithAudio = [];
    const feedsWithoutAudio = [];
    
    for (const [feedTitle, tracks] of Object.entries(feedGroups)) {
        const hasAudio = tracks.some(t => t.enclosureUrl);
        const feedUrl = tracks[0].feedUrl;
        
        if (hasAudio) {
            feedsWithAudio.push({ feedTitle, feedUrl, trackCount: tracks.length, tracks });
        } else {
            feedsWithoutAudio.push({ feedTitle, feedUrl, trackCount: tracks.length });
        }
    }
    
    console.log(`📻 Feeds with audio that could have real durations (${feedsWithAudio.length}):`);
    feedsWithAudio.forEach(feed => {
        console.log(`  "${feed.feedTitle}" - ${feed.trackCount} tracks`);
        console.log(`     URL: ${feed.feedUrl}`);
    });
    
    console.log(`\n📭 Feeds without audio (expected 180s placeholder) (${feedsWithoutAudio.length}):`);
    feedsWithoutAudio.forEach(feed => {
        console.log(`  "${feed.feedTitle}" - ${feed.trackCount} tracks`);
    });
    
    console.log(`\n🎯 RECOMMENDATION:`);
    console.log(`- ${feedsWithoutAudio.reduce((sum, f) => sum + f.trackCount, 0)} tracks without audio: Keep 180s placeholder`);
    console.log(`- ${feedsWithAudio.reduce((sum, f) => sum + f.trackCount, 0)} tracks with audio: Could fetch real durations from feeds`);
    
    // Check if any of these feeds are accessible for duration updates
    if (feedsWithAudio.length > 0) {
        console.log(`\n🔄 Testing feed accessibility for duration updates...`);
        
        for (const feed of feedsWithAudio.slice(0, 3)) { // Test first 3 feeds
            try {
                console.log(`\n📡 Testing: ${feed.feedUrl}`);
                const response = await fetch(feed.feedUrl, { timeout: 10000 });
                if (response.ok) {
                    const xmlText = await response.text();
                    
                    // Look for duration tags in the first item
                    const itemMatch = xmlText.match(/<item>[\s\S]*?<\/item>/);
                    if (itemMatch) {
                        const durationMatch = itemMatch[0].match(/<itunes:duration>(.*?)<\/itunes:duration>/);
                        if (durationMatch) {
                            console.log(`  ✅ Feed has duration data: ${durationMatch[1]}`);
                            console.log(`  💡 This feed could be updated with real durations`);
                        } else {
                            console.log(`  ⚠️ Feed accessible but no duration tags found`);
                        }
                    }
                } else {
                    console.log(`  ❌ Feed not accessible (HTTP ${response.status})`);
                }
            } catch (error) {
                console.log(`  ❌ Feed error: ${error.message}`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log(`\n✅ Investigation complete!`);
    
    // Save analysis results
    const analysisResults = {
        totalPlaceholderTracks: placeholderTracks.length,
        feedsWithAudio: feedsWithAudio.length,
        feedsWithoutAudio: feedsWithoutAudio.length,
        feedAnalysis: {
            withAudio: feedsWithAudio,
            withoutAudio: feedsWithoutAudio
        },
        recommendation: 'Feeds with audio URLs could potentially have their durations updated by re-parsing RSS feeds'
    };
    
    const analysisPath = path.join(process.cwd(), 'data', `placeholder-duration-analysis-${Date.now()}.json`);
    fs.writeFileSync(analysisPath, JSON.stringify(analysisResults, null, 2));
    console.log(`📋 Analysis saved: ${path.basename(analysisPath)}`);
}

investigatePlaceholderDurations();