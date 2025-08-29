#!/usr/bin/env node

/**
 * Fix missing artwork for Sara Jade Sink or Swim EP
 */

const fs = require('fs');
const path = require('path');

function fixSaraJadeArtwork() {
    console.log('🎨 Fixing Sara Jade Sink or Swim EP Artwork\n');
    
    const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
    
    // Find Sara Jade tracks
    const saraJadeTracks = musicData.musicTracks.filter(track => 
        track.feedTitle && track.feedTitle.includes('Sink or Swim') && 
        track.feedArtist && track.feedArtist.includes('Sara Jade')
    );
    
    console.log(`📊 Found ${saraJadeTracks.length} Sara Jade tracks`);
    
    if (saraJadeTracks.length === 0) {
        console.log('❌ No Sara Jade Sink or Swim EP tracks found');
        return;
    }
    
    // Get the correct artwork URL from the first track that has it
    const correctArtworkUrl = 'https://d12wklypp119aj.cloudfront.net/image/0a131404-899f-4a7d-a2f3-3dbb61622887.jpg';
    
    console.log(`🖼️ Using artwork URL: ${correctArtworkUrl}`);
    
    let updatedCount = 0;
    
    // Update all Sara Jade tracks with the correct artwork
    saraJadeTracks.forEach(track => {
        let updated = false;
        
        if (!track.feedImage) {
            track.feedImage = correctArtworkUrl;
            updated = true;
        }
        
        if (!track.image) {
            track.image = correctArtworkUrl;
            updated = true;
        }
        
        if (updated) {
            updatedCount++;
            console.log(`✅ Updated "${track.title}"`);
        } else {
            console.log(`✓ "${track.title}" already has artwork`);
        }
    });
    
    if (updatedCount > 0) {
        console.log(`\n💾 Saving ${updatedCount} artwork updates...`);
        
        // Update metadata
        musicData.metadata = {
            ...musicData.metadata,
            lastUpdated: new Date().toISOString(),
            saraJadeArtworkFix: {
                date: new Date().toISOString(),
                tracksUpdated: updatedCount,
                artworkUrl: correctArtworkUrl,
                note: 'Fixed missing artwork for Sara Jade Sink or Swim EP tracks'
            }
        };
        
        // Create backup
        const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-sara-jade-fix-${Date.now()}.json`);
        const backupData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`📋 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated database
        fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
        console.log(`✅ Database updated with ${updatedCount} artwork fixes`);
        
        // Regenerate the optimized cache
        console.log('\n🔄 Regenerating optimized cache...');
        const { execSync } = require('child_process');
        try {
            execSync('node scripts/create-optimized-cache.js', { stdio: 'inherit' });
            console.log('✅ Optimized cache regenerated');
        } catch (error) {
            console.log('⚠️ Failed to regenerate cache automatically');
        }
        
    } else {
        console.log('\n💫 All Sara Jade tracks already have artwork');
    }
    
    console.log('\n✅ Sara Jade artwork fix complete!');
}

fixSaraJadeArtwork();