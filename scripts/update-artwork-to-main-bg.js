#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function updateArtworkToMainBg() {
    console.log('🖼️  Updating Generic Artwork to Main Page Background Image\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-artwork-bg-update-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Main page background image URL
    const mainBgImage = '/stablekraft-rocket.png';
    
    // Find tracks with generic artwork assignments
    const tracksWithGenericArtwork = musicData.musicTracks.filter(track => 
        track.artworkSource &&
        track.artworkSource.method === 'generic-assignment' &&
        track.artwork && 
        track.artwork.includes('unsplash.com')
    );
    
    console.log(`Found ${tracksWithGenericArtwork.length} tracks with generic Unsplash artwork to update\n`);
    
    if (tracksWithGenericArtwork.length === 0) {
        console.log('✅ No tracks with generic artwork found');
        return;
    }
    
    let updatedCount = 0;
    
    // Update to main page background
    for (const track of tracksWithGenericArtwork) {
        const oldArtwork = track.artwork;
        const oldType = track.artworkSource.type;
        
        track.artwork = mainBgImage;
        track.artworkSource = {
            method: 'main-page-background',
            reason: 'using site\'s main background image as placeholder',
            originalType: oldType,
            assignedDate: new Date().toISOString(),
            note: 'Main page background used for consistent branding'
        };
        
        updatedCount++;
        console.log(`🖼️ "${track.title}" by ${track.artist}: updated to main bg (was: ${oldType})`);
    }
    
    // Update metadata
    musicData.metadata.lastArtworkBgUpdate = {
        date: new Date().toISOString(),
        tracksUpdated: updatedCount,
        method: 'Main Page Background Assignment',
        backgroundImage: mainBgImage,
        purpose: 'Consistent branding with site background'
    };
    
    // Save the updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Artwork Background Update Summary:');
    console.log(`  🖼️  Tracks updated: ${updatedCount}`);
    console.log(`  🎨 New artwork: ${mainBgImage}`);
    console.log(`  🎯 Purpose: Consistent branding with main page background`);
    
    // Calculate coverage
    const totalTracks = musicData.musicTracks.length;
    const tracksWithArtwork = musicData.musicTracks.filter(track => 
        track.artwork && track.artwork !== '' && track.artwork !== '/api/placeholder/300/300'
    ).length;
    const tracksWithMainBg = musicData.musicTracks.filter(track => 
        track.artwork === mainBgImage
    ).length;
    
    console.log('\n📊 Artwork Coverage Breakdown:');
    console.log(`  ✅ Total tracks with artwork: ${tracksWithArtwork}/${totalTracks} (${((tracksWithArtwork / totalTracks) * 100).toFixed(1)}%)`);
    console.log(`  🖼️  Using main page background: ${tracksWithMainBg} tracks`);
    console.log(`  🎨 Using original artwork: ${tracksWithArtwork - tracksWithMainBg} tracks`);
    
    console.log('\n✨ Artwork background update complete!');
    console.log('🎯 All placeholder artwork now uses your site\'s main background for consistent branding.');
}

// Run the update
updateArtworkToMainBg();