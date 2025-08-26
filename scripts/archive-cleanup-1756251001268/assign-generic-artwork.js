#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function assignGenericArtwork() {
    console.log('🎨 Assigning Generic Artwork to Tracks Missing Images\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-artwork-assignment-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find real tracks missing artwork
    const tracksNeedingArtwork = musicData.musicTracks.filter(track => 
        (!track.artwork || track.artwork === '' || track.artwork === '/api/placeholder/300/300') &&
        track.title && 
        track.artist &&
        track.artist !== 'Unknown Artist' &&
        track.artist !== 'Independent Artist' &&
        !track.title.startsWith('Track ') &&
        !track.title.startsWith('Unindexed') &&
        track.title !== 'Unknown Track'
    );
    
    console.log(`Found ${tracksNeedingArtwork.length} real tracks missing artwork\n`);
    
    if (tracksNeedingArtwork.length === 0) {
        console.log('✅ All real tracks already have artwork');
        return;
    }
    
    // Define generic artwork URLs based on genre/style
    const genericArtwork = {
        rock: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        electronic: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&h=300&fit=crop',
        indie: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop',
        folk: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300&h=300&fit=crop',
        jazz: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=300&h=300&fit=crop',
        classical: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300&h=300&fit=crop',
        ambient: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&h=300&fit=crop',
        hip_hop: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        country: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300&h=300&fit=crop',
        pop: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        default: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop'
    };
    
    let assignedCount = 0;
    const artworkStats = {};
    
    // Assign artwork based on genre detection or default
    for (const track of tracksNeedingArtwork) {
        let artworkType = 'default';
        let detectionReason = 'generic music artwork';
        
        // Try to detect genre from various sources
        if (track.genre) {
            const genre = track.genre.toLowerCase();
            if (genre.includes('rock')) artworkType = 'rock';
            else if (genre.includes('electronic') || genre.includes('techno') || genre.includes('house')) artworkType = 'electronic';
            else if (genre.includes('indie')) artworkType = 'indie';
            else if (genre.includes('folk')) artworkType = 'folk';
            else if (genre.includes('jazz')) artworkType = 'jazz';
            else if (genre.includes('classical')) artworkType = 'classical';
            else if (genre.includes('ambient')) artworkType = 'ambient';
            else if (genre.includes('hip') || genre.includes('rap')) artworkType = 'hip_hop';
            else if (genre.includes('country')) artworkType = 'country';
            else if (genre.includes('pop')) artworkType = 'pop';
            
            detectionReason = `detected genre: ${track.genre}`;
        }
        // Try to detect from title keywords
        else {
            const title = track.title.toLowerCase();
            const artist = track.artist.toLowerCase();
            const combined = title + ' ' + artist;
            
            if (combined.includes('rock') || combined.includes('metal')) {
                artworkType = 'rock';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('electronic') || combined.includes('synth') || combined.includes('beat')) {
                artworkType = 'electronic';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('indie') || combined.includes('alternative')) {
                artworkType = 'indie';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('folk') || combined.includes('acoustic')) {
                artworkType = 'folk';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('jazz') || combined.includes('blues')) {
                artworkType = 'jazz';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('classical') || combined.includes('orchestra')) {
                artworkType = 'classical';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('ambient') || combined.includes('drone')) {
                artworkType = 'ambient';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('hip') || combined.includes('rap')) {
                artworkType = 'hip_hop';
                detectionReason = 'detected from title/artist keywords';
            }
            else if (combined.includes('country') || combined.includes('cowboy')) {
                artworkType = 'country';
                detectionReason = 'detected from title/artist keywords';
            }
        }
        
        track.artwork = genericArtwork[artworkType];
        track.artworkSource = {
            method: 'generic-assignment',
            type: artworkType,
            reason: detectionReason,
            assignedDate: new Date().toISOString()
        };
        
        // Track stats
        if (!artworkStats[artworkType]) artworkStats[artworkType] = 0;
        artworkStats[artworkType]++;
        
        assignedCount++;
        
        console.log(`🎨 "${track.title}" by ${track.artist}: ${artworkType} artwork (${detectionReason})`);
    }
    
    // Update metadata
    musicData.metadata.lastArtworkAssignment = {
        date: new Date().toISOString(),
        tracksProcessed: assignedCount,
        method: 'Smart Generic Assignment',
        artworkTypes: artworkStats
    };
    
    // Save the updated data
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Artwork Assignment Summary:');
    console.log(`  ✅ Tracks assigned artwork: ${assignedCount}`);
    console.log('  🎨 Artwork types assigned:');
    
    Object.entries(artworkStats).forEach(([type, count]) => {
        console.log(`    ${type}: ${count} tracks`);
    });
    
    // Calculate new coverage
    const totalTracks = musicData.musicTracks.length;
    const tracksWithArtwork = musicData.musicTracks.filter(track => 
        track.artwork && track.artwork !== '' && track.artwork !== '/api/placeholder/300/300'
    ).length;
    const artworkCoverage = (tracksWithArtwork / totalTracks * 100).toFixed(1);
    
    console.log(`  📈 New artwork coverage: ${artworkCoverage}% (${tracksWithArtwork}/${totalTracks})`);
    
    console.log('\n✨ Generic artwork assignment complete!');
}

// Run the assignment
assignGenericArtwork();