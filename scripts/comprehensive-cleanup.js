#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function comprehensiveCleanup() {
    console.log('🧹 Comprehensive Scripts Cleanup\n');
    console.log('=' .repeat(60) + '\n');
    
    const scriptsDir = __dirname;
    
    // Only keep the truly essential scripts for the current system
    const scriptsToKeep = [
        // Core music database scripts (final versions)
        'comprehensive-music-discovery.js',
        'assign-default-durations.js', 
        'update-duration-to-9999.js',
        'update-artwork-to-main-bg.js',
        'remove-placeholder-tracks.js',
        
        // Original import workflow (keep for reference)
        'add-iam-playlist-tracks.js',
        'properly-resolve-iam-tracks.js',
        'remove-iam-duplicates.js',
        
        // Utility/maintenance
        'cleanup-old-scripts.js',
        'comprehensive-cleanup.js',
        
        // README files
        'README.md',
        'README-ESSENTIAL-SCRIPTS.md',
        'README-UPDATE-WORKFLOW.md',
        'README-hgh-resolution.md'
    ];
    
    // Get all JS files in scripts directory
    const allFiles = fs.readdirSync(scriptsDir)
        .filter(file => file.endsWith('.js'))
        .filter(file => !file.startsWith('.'));
    
    // Files to archive (everything not in keep list)
    const filesToArchive = allFiles.filter(file => !scriptsToKeep.includes(file));
    
    console.log('📋 Comprehensive Analysis:');
    console.log(`  📁 Total JS files found: ${allFiles.length}`);
    console.log(`  ✅ Files to keep: ${scriptsToKeep.filter(f => f.endsWith('.js')).length}`);
    console.log(`  🗑️  Files to archive: ${filesToArchive.length}`);
    console.log('');
    
    // Create archive directory
    const archiveDir = path.join(scriptsDir, 'archive-comprehensive-' + Date.now());
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir);
        console.log(`📦 Created archive: ${path.basename(archiveDir)}\n`);
    }
    
    let archivedCount = 0;
    let keepCount = 0;
    
    // Process each file
    allFiles.forEach(fileName => {
        if (scriptsToKeep.includes(fileName)) {
            console.log(`✅ Keeping: ${fileName}`);
            keepCount++;
        } else {
            const sourcePath = path.join(scriptsDir, fileName);
            const archivePath = path.join(archiveDir, fileName);
            
            try {
                fs.renameSync(sourcePath, archivePath);
                console.log(`📦 Archived: ${fileName}`);
                archivedCount++;
            } catch (error) {
                console.log(`❌ Failed to archive ${fileName}: ${error.message}`);
            }
        }
    });
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Comprehensive Cleanup Summary:');
    console.log(`  ✅ Essential scripts kept: ${keepCount}`);
    console.log(`  📦 Scripts archived: ${archivedCount}`);
    console.log(`  🎯 Directory reduction: ${Math.round(archivedCount/allFiles.length*100)}%`);
    
    console.log('\n🎵 Final Essential Scripts:');
    scriptsToKeep.filter(f => f.endsWith('.js')).forEach(script => {
        const scriptPath = path.join(scriptsDir, script);
        if (fs.existsSync(scriptPath)) {
            console.log(`  ✅ ${script}`);
        } else {
            console.log(`  ⚠️  Missing: ${script}`);
        }
    });
    
    console.log(`\n🗂️  All legacy scripts moved to: ${path.basename(archiveDir)}`);
    console.log('💡 You can delete the archive after confirming everything works.');
    
    console.log('\n✨ Comprehensive cleanup complete!');
    console.log('🎯 Scripts directory is now minimal and focused.');
}

// Run the comprehensive cleanup
comprehensiveCleanup();