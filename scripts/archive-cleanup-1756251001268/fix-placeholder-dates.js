#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔍 Fixing Placeholder Dates\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-dates-${Date.now()}`;
    console.log(`Creating backup at ${backupPath}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks with placeholder dates (future date 2025-08-23)
    const placeholderTracks = musicData.musicTracks.filter(track => 
        track.addedDate?.startsWith('2025-08-23')
    );
    
    console.log(`Found ${placeholderTracks.length} tracks with placeholder dates (2025-08-23)`);
    
    // Get current date
    const today = new Date().toISOString();
    let fixedCount = 0;
    let inferredCount = 0;
    
    // First pass: Try to infer dates from similar tracks
    console.log('\n🔍 Inferring dates from similar tracks...');
    
    placeholderTracks.forEach(track => {
        // Find similar tracks with real dates (same album/artist)
        const similarTrack = musicData.musicTracks.find(t => 
            t !== track &&
            (t.album === track.album || t.albumTitle === track.albumTitle) &&
            t.artist === track.artist &&
            t.datePublished &&
            !t.datePublished.startsWith('2025')
        );
        
        if (similarTrack) {
            // Use the date from similar track
            track.datePublished = similarTrack.datePublished;
            track.pubDate = similarTrack.pubDate || similarTrack.datePublished;
            track.addedDate = similarTrack.datePublished;
            inferredCount++;
            console.log(`  Inferred date for: "${track.title}" from similar track`);
        }
    });
    
    // Second pass: Fix remaining with today's date
    console.log('\n🔄 Fixing remaining placeholder dates...');
    
    musicData.musicTracks.forEach(track => {
        if (track.addedDate?.startsWith('2025-08-23')) {
            // Replace with today's date
            track.addedDate = today;
            
            // Only update other date fields if they're also placeholder or missing
            if (!track.datePublished || track.datePublished.startsWith('2025')) {
                track.datePublished = today;
            }
            if (!track.pubDate || track.pubDate.startsWith('2025')) {
                track.pubDate = today;
            }
            
            fixedCount++;
        }
    });
    
    // Check for any other suspicious future dates
    const futureTracks = musicData.musicTracks.filter(track => {
        const date = track.addedDate || track.datePublished;
        if (!date) return false;
        const trackDate = new Date(date);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return trackDate > tomorrow;
    });
    
    if (futureTracks.length > 0) {
        console.log(`\n⚠️  Found ${futureTracks.length} tracks with other future dates`);
        futureTracks.forEach(track => {
            console.log(`  - "${track.title}" has date: ${track.addedDate || track.datePublished}`);
            // Fix these too
            track.addedDate = today;
            if (track.datePublished && new Date(track.datePublished) > new Date()) {
                track.datePublished = today;
            }
            if (track.pubDate && new Date(track.pubDate) > new Date()) {
                track.pubDate = today;
            }
        });
    }
    
    // Save updated data
    console.log('\n💾 Saving updated music tracks...');
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Verify the fix
    const updatedData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const stillPlaceholder = updatedData.musicTracks.filter(t => 
        t.addedDate?.startsWith('2025-08-23')
    );
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`- Inferred dates for ${inferredCount} tracks from similar tracks`);
    console.log(`- Fixed ${fixedCount} tracks with placeholder dates`);
    console.log(`- Remaining tracks with 2025-08-23: ${stillPlaceholder.length}`);
    console.log(`- Total tracks in database: ${musicData.musicTracks.length}`);
    console.log(`- Backup saved at: ${backupPath}`);
    
    if (stillPlaceholder.length === 0) {
        console.log('\n✅ All placeholder dates have been fixed!');
    }
}

main().catch(console.error);