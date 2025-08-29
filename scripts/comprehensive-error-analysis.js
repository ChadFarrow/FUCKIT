#!/usr/bin/env node

/**
 * Comprehensive database error analysis
 * Identifies various types of data quality issues
 */

const fs = require('fs');

function analyzeDatabase() {
    console.log('🔍 Comprehensive Database Error Analysis\n');
    console.log('=' .repeat(60));
    
    const data = JSON.parse(fs.readFileSync('data/music-tracks.json', 'utf8'));
    const tracks = data.musicTracks;
    
    console.log(`📊 Analyzing ${tracks.length} tracks...\n`);
    
    const issues = {
        missingUrls: [],
        suspiciousDurations: [],
        malformedData: [],
        duplicates: [],
        brokenFeeds: [],
        encodingIssues: [],
        placeholderData: []
    };
    
    // Group by feed for analysis
    const feedGroups = new Map();
    tracks.forEach(track => {
        const key = track.feedUrl || 'unknown';
        if (!feedGroups.has(key)) feedGroups.set(key, []);
        feedGroups.get(key).push(track);
    });
    
    console.log('1️⃣ MISSING AUDIO URLs');
    console.log('-' .repeat(30));
    const noAudioTracks = tracks.filter(t => !t.enclosureUrl);
    console.log(`Found ${noAudioTracks.length} tracks without audio URLs (${(noAudioTracks.length/tracks.length*100).toFixed(1)}%)`);
    
    if (noAudioTracks.length > 0) {
        const feedCounts = {};
        noAudioTracks.forEach(t => {
            const feed = t.feedTitle || 'Unknown';
            feedCounts[feed] = (feedCounts[feed] || 0) + 1;
        });
        
        console.log('Top feeds missing audio URLs:');
        Object.entries(feedCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([feed, count]) => {
                console.log(`  ${count} tracks from "${feed}"`);
            });
    }
    
    console.log('\n2️⃣ SUSPICIOUS DURATIONS');
    console.log('-' .repeat(30));
    const suspiciousDurations = tracks.filter(t => 
        !t.duration || t.duration === 0 || t.duration === 180 || t.duration > 3600
    );
    console.log(`Found ${suspiciousDurations.length} tracks with suspicious durations`);
    
    if (suspiciousDurations.length > 0) {
        const durationIssues = {
            zero: tracks.filter(t => !t.duration || t.duration === 0).length,
            placeholder: tracks.filter(t => t.duration === 180).length,
            tooLong: tracks.filter(t => t.duration > 3600).length
        };
        console.log('  Zero/missing duration:', durationIssues.zero);
        console.log('  Placeholder (3:00):', durationIssues.placeholder);
        console.log('  Over 1 hour:', durationIssues.tooLong);
    }
    
    console.log('\n3️⃣ ENCODING & TEXT ISSUES');
    console.log('-' .repeat(30));
    const encodingIssues = tracks.filter(t => 
        (t.title && (t.title.includes('&amp;') || t.title.includes('&lt;') || t.title.includes('&gt;'))) ||
        (t.feedTitle && (t.feedTitle.includes('&amp;') || t.feedTitle.includes('&lt;') || t.feedTitle.includes('&gt;'))) ||
        (t.feedArtist && (t.feedArtist.includes('&amp;') || t.feedArtist.includes('&lt;') || t.feedArtist.includes('&gt;')))
    );
    console.log(`Found ${encodingIssues.length} tracks with encoding issues`);
    
    if (encodingIssues.length > 0) {
        console.log('Sample encoding issues:');
        encodingIssues.slice(0, 5).forEach(track => {
            if (track.title.includes('&amp;')) {
                console.log(`  Title: "${track.title}" from "${track.feedTitle}"`);
            }
        });
    }
    
    console.log('\n4️⃣ DUPLICATE TRACKS IN ALBUMS');
    console.log('-' .repeat(30));
    let totalDuplicates = 0;
    const albumsWithDuplicates = [];
    
    feedGroups.forEach((albumTracks, feedUrl) => {
        if (albumTracks.length <= 1) return;
        
        const titleCounts = {};
        albumTracks.forEach(track => {
            titleCounts[track.title] = (titleCounts[track.title] || 0) + 1;
        });
        
        const duplicates = Object.entries(titleCounts).filter(([title, count]) => count > 1);
        if (duplicates.length > 0) {
            const albumTitle = albumTracks[0].feedTitle || 'Unknown';
            albumsWithDuplicates.push({
                album: albumTitle,
                feedUrl,
                totalTracks: albumTracks.length,
                duplicates: duplicates.map(([title, count]) => ({ title, count }))
            });
            totalDuplicates += duplicates.reduce((sum, [, count]) => sum + count - 1, 0);
        }
    });
    
    console.log(`Found ${totalDuplicates} duplicate tracks across ${albumsWithDuplicates.length} albums`);
    if (albumsWithDuplicates.length > 0) {
        console.log('Albums with duplicates:');
        albumsWithDuplicates.slice(0, 5).forEach(album => {
            console.log(`  "${album.album}" (${album.totalTracks} tracks)`);
            album.duplicates.forEach(dup => {
                console.log(`    - "${dup.title}" appears ${dup.count} times`);
            });
        });
    }
    
    console.log('\n5️⃣ PLACEHOLDER & GENERIC DATA');
    console.log('-' .repeat(30));
    const placeholderTracks = tracks.filter(t => 
        t.feedArtist === 'Unknown Artist' ||
        t.feedTitle === 'Unknown Album' ||
        (t.title && (
            t.title.toLowerCase().includes('untitled') ||
            t.title.toLowerCase().includes('track ') ||
            t.title.toLowerCase().includes('song ')
        ))
    );
    console.log(`Found ${placeholderTracks.length} tracks with placeholder/generic data`);
    
    console.log('\n6️⃣ BROKEN OR SUSPICIOUS FEED URLs');
    console.log('-' .repeat(30));
    const feedAnalysis = {};
    feedGroups.forEach((albumTracks, feedUrl) => {
        const hasAudio = albumTracks.some(t => t.enclosureUrl);
        const avgDuration = albumTracks.reduce((sum, t) => sum + (t.duration || 0), 0) / albumTracks.length;
        
        feedAnalysis[feedUrl] = {
            trackCount: albumTracks.length,
            hasAudio,
            avgDuration,
            title: albumTracks[0].feedTitle
        };
    });
    
    const suspiciousFeeds = Object.entries(feedAnalysis).filter(([url, info]) => 
        !info.hasAudio || info.trackCount === 1 && info.avgDuration === 180
    );
    
    console.log(`Found ${suspiciousFeeds.length} potentially broken feeds:`);
    suspiciousFeeds.slice(0, 10).forEach(([url, info]) => {
        console.log(`  "${info.title}" - ${info.trackCount} tracks, audio: ${info.hasAudio ? 'Yes' : 'No'}`);
    });
    
    console.log('\n7️⃣ MISSING METADATA FIELDS');
    console.log('-' .repeat(30));
    const metadataIssues = {
        missingImages: tracks.filter(t => !t.image && !t.feedImage).length,
        missingPubDate: tracks.filter(t => !t.datePublished && !t.pubDate).length,
        missingDescription: tracks.filter(t => !t.description).length
    };
    
    console.log(`Missing images: ${metadataIssues.missingImages} (${(metadataIssues.missingImages/tracks.length*100).toFixed(1)}%)`);
    console.log(`Missing pub dates: ${metadataIssues.missingPubDate} (${(metadataIssues.missingPubDate/tracks.length*100).toFixed(1)}%)`);
    console.log(`Missing descriptions: ${metadataIssues.missingDescription} (${(metadataIssues.missingDescription/tracks.length*100).toFixed(1)}%)`);
    
    console.log('\n8️⃣ DATA QUALITY SUMMARY');
    console.log('-' .repeat(30));
    const qualityScore = {
        hasAudio: tracks.filter(t => t.enclosureUrl).length / tracks.length,
        hasValidDuration: tracks.filter(t => t.duration && t.duration > 0 && t.duration !== 180).length / tracks.length,
        hasImage: tracks.filter(t => t.image || t.feedImage).length / tracks.length,
        noPlaceholders: tracks.filter(t => t.feedArtist !== 'Unknown Artist' && t.feedTitle !== 'Unknown Album').length / tracks.length
    };
    
    const overallScore = (qualityScore.hasAudio + qualityScore.hasValidDuration + qualityScore.hasImage + qualityScore.noPlaceholders) / 4;
    
    console.log(`Overall Data Quality Score: ${(overallScore * 100).toFixed(1)}%`);
    console.log(`  Audio URLs: ${(qualityScore.hasAudio * 100).toFixed(1)}%`);
    console.log(`  Valid Durations: ${(qualityScore.hasValidDuration * 100).toFixed(1)}%`);
    console.log(`  Images: ${(qualityScore.hasImage * 100).toFixed(1)}%`);
    console.log(`  No Placeholders: ${(qualityScore.noPlaceholders * 100).toFixed(1)}%`);
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 TOP PRIORITIES FOR IMPROVEMENT:');
    console.log('=' .repeat(60));
    
    const priorities = [
        { issue: `${noAudioTracks.length} tracks missing audio URLs`, severity: 'HIGH', impact: 'Users cannot play these tracks' },
        { issue: `${totalDuplicates} duplicate tracks`, severity: 'MEDIUM', impact: 'Confusing user experience' },
        { issue: `${encodingIssues.length} tracks with encoding issues`, severity: 'LOW', impact: 'Display problems' },
        { issue: `${suspiciousFeeds.length} potentially broken feeds`, severity: 'MEDIUM', impact: 'Missing content' }
    ].filter(p => parseInt(p.issue) > 0);
    
    priorities.forEach((priority, i) => {
        console.log(`${i + 1}. [${priority.severity}] ${priority.issue}`);
        console.log(`   Impact: ${priority.impact}`);
    });
    
    console.log('\n✅ Analysis complete!');
}

analyzeDatabase();