#!/usr/bin/env node

/**
 * Clean up CDATA encoding in deathdreams track titles
 */

const fs = require('fs');
const path = require('path');

async function cleanDeathDreamsTitles() {
    try {
        console.log('🔧 Cleaning up deathdreams track titles...\n');
        
        // Load database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Find and fix deathdreams tracks with CDATA in titles
        let fixedCount = 0;
        musicData.musicTracks.forEach(track => {
            if (track.feedTitle && track.feedTitle.toLowerCase() === 'deathdreams' && 
                track.title && track.title.includes('<![CDATA[')) {
                
                const originalTitle = track.title;
                const cleanTitle = track.title
                    .replace('<![CDATA[', '')
                    .replace(']]>', '');
                
                track.title = cleanTitle;
                console.log(`Fixed: "${originalTitle}" → "${cleanTitle}"`);
                fixedCount++;
            }
        });
        
        if (fixedCount > 0) {
            // Update metadata
            musicData.metadata = {
                ...musicData.metadata,
                lastUpdated: new Date().toISOString(),
                titleCleanup: {
                    date: new Date().toISOString(),
                    fixedTracks: fixedCount,
                    note: 'Cleaned up CDATA encoding in deathdreams track titles'
                }
            };
            
            // Save updated database
            fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
            console.log(`\\n✅ Fixed ${fixedCount} track titles and updated database`);
        } else {
            console.log('ℹ️ No CDATA titles found to fix');
        }
        
    } catch (error) {
        console.error('❌ Error cleaning titles:', error);
    }
}

// Run the cleanup
cleanDeathDreamsTitles();