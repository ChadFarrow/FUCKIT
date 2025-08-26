#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function cleanupOldScripts() {
    console.log('🧹 Cleaning Up Old and Redundant Scripts\n');
    console.log('=' .repeat(60) + '\n');
    
    const scriptsDir = __dirname;
    
    // Scripts that are superseded by our final comprehensive approach
    const scriptsToRemove = [
        // Old batch processing scripts (replaced by comprehensive-music-discovery.js)
        'batch-remote-items.js',
        'batch2-remote-items.js', 'batch3-remote-items.js', 'batch4-remote-items.js',
        'batch5-remote-items.js', 'batch6-remote-items.js', 'batch7-remote-items.js',
        'batch8-remote-items.js', 'batch9-remote-items.js', 'batch10-remote-items.js',
        'batch11-remote-items.js', 'batch12-remote-items.js', 'batch13-remote-items.js',
        
        // Old resolution attempts (replaced by comprehensive approach)
        'add-all-remote-items.js',
        'add-missing-remote-items.js',
        'add-missing-remote-items-pi-api.js',
        'add-new-remote-items.js',
        'resolve-all-metadata.js',
        'resolve-metadata-fast.js',
        'resolve-metadata-optimized.js',
        'resolve-metadata-parallel.js',
        'resolve-metadata-smart.js',
        'resolve-missing-wavlake-tracks.js',
        
        // Old analysis scripts (replaced by comprehensive analysis)
        'analyze-missing-metadata.js',
        'analyze-artwork-duration.js',
        'final-cleanup-strategy.js',
        
        // Superseded enhancement scripts
        'enhance-all-remote-tracks.js',
        'enhance-recent-tracks.js',
        'enhance-missing-metadata.js',
        
        // Old external resolution (replaced by final approach)
        'external-metadata-resolver.js',
        'audio-metadata-extractor.js',
        
        // Testing and diagnosis scripts that are no longer needed
        'test-music-endpoints.js',
        'test-guid-formats.js',
        'check-database-status.js',
        'check-dates.js',
        'check-remote-item-guids.js',
        'diagnose-feed-accessibility.js',
        'fetch-missing-dates.js',
        'fix-dates-final.js',
        'fix-placeholder-dates.js',
        'parse-duration-strings.js',
        
        // Old duration/artwork assignment attempts
        'update-durations-to-recognizable.js', // Replaced by update-duration-to-9999.js
        'assign-generic-artwork.js', // Replaced by update-artwork-to-main-bg.js
    ];
    
    // Scripts to keep (core/final/useful ones)
    const scriptsToKeep = [
        'comprehensive-music-discovery.js', // Main discovery script
        'assign-default-durations.js',      // Duration assignment
        'update-duration-to-9999.js',       // Final duration pattern
        'update-artwork-to-main-bg.js',     // Final artwork assignment
        'remove-placeholder-tracks.js',     // Database cleanup
        'add-iam-playlist-tracks.js',       // Original IAM import
        'properly-resolve-iam-tracks.js',   // Working resolution
        'remove-iam-duplicates.js',         // Deduplication
        'cleanup-old-scripts.js',           // This cleanup script
        // Keep any README files and core functionality
    ];
    
    console.log('📋 Scripts Analysis:');
    console.log(`  🗑️  To remove: ${scriptsToRemove.length} scripts`);
    console.log(`  ✅ To keep: ${scriptsToKeep.length} core scripts`);
    console.log('');
    
    // Create an archive directory for removed scripts
    const archiveDir = path.join(scriptsDir, 'archive-cleanup-' + Date.now());
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir);
        console.log(`📦 Created archive directory: ${path.basename(archiveDir)}\n`);
    }
    
    let movedCount = 0;
    let notFoundCount = 0;
    
    // Move old scripts to archive
    scriptsToRemove.forEach(scriptName => {
        const scriptPath = path.join(scriptsDir, scriptName);
        const archivePath = path.join(archiveDir, scriptName);
        
        if (fs.existsSync(scriptPath)) {
            try {
                fs.renameSync(scriptPath, archivePath);
                console.log(`📦 Archived: ${scriptName}`);
                movedCount++;
            } catch (error) {
                console.log(`❌ Failed to archive ${scriptName}: ${error.message}`);
            }
        } else {
            console.log(`⚠️  Not found: ${scriptName}`);
            notFoundCount++;
        }
    });
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Cleanup Summary:');
    console.log(`  📦 Scripts archived: ${movedCount}`);
    console.log(`  ⚠️  Scripts not found: ${notFoundCount}`);
    console.log(`  ✅ Core scripts retained`);
    
    // Create a summary of what was kept
    console.log('\n🎯 Remaining Core Scripts:');
    scriptsToKeep.forEach(script => {
        if (fs.existsSync(path.join(scriptsDir, script))) {
            console.log(`  ✅ ${script}`);
        }
    });
    
    console.log(`\n🗂️  Archived scripts moved to: ${path.basename(archiveDir)}`);
    console.log('📝 You can safely delete the archive directory after confirming the cleanup worked.');
    
    console.log('\n✨ Script cleanup complete!');
    console.log('🎯 Scripts directory is now clean and focused on essential tools.');
}

// Run the cleanup
cleanupOldScripts();