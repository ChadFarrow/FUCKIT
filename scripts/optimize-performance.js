#!/usr/bin/env node

/**
 * Performance optimization analysis and fixes for slow main page loading
 */

const fs = require('fs');
const path = require('path');

async function analyzePerformance() {
    console.log('🚀 Performance Optimization Analysis\n');
    console.log('=' .repeat(50));
    
    try {
        // Analyze data file sizes
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
        
        const musicDbSize = fs.existsSync(musicDbPath) ? fs.statSync(musicDbPath).size : 0;
        const parsedFeedsSize = fs.existsSync(parsedFeedsPath) ? fs.statSync(parsedFeedsPath).size : 0;
        
        console.log('📊 Data File Sizes:');
        console.log(`  music-tracks.json: ${(musicDbSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  parsed-feeds.json: ${(parsedFeedsSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Load and analyze music tracks data
        if (fs.existsSync(musicDbPath)) {
            const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
            const tracks = musicData.musicTracks || [];
            
            console.log('\n🎵 Music Database Analysis:');
            console.log(`  Total tracks: ${tracks.length}`);
            
            // Analyze track sizes and data redundancy
            const trackSample = tracks[0] || {};
            const sampleSize = JSON.stringify(trackSample).length;
            console.log(`  Average track size: ~${sampleSize} bytes`);
            console.log(`  Estimated total size: ~${(sampleSize * tracks.length / 1024 / 1024).toFixed(2)} MB`);
            
            // Analyze fields contributing to size
            const fieldSizes = {};
            Object.keys(trackSample).forEach(field => {
                if (trackSample[field]) {
                    fieldSizes[field] = JSON.stringify(trackSample[field]).length;
                }
            });
            
            console.log('\n📋 Field Size Analysis:');
            Object.entries(fieldSizes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([field, size]) => {
                    console.log(`  ${field}: ${size} bytes`);
                });
            
            // Check for potential optimizations
            console.log('\n⚡ Performance Optimization Opportunities:');
            
            // 1. Check for redundant data
            const feedUrls = new Set(tracks.map(t => t.feedUrl));
            const feedTitles = new Set(tracks.map(t => t.feedTitle));
            const artists = new Set(tracks.map(t => t.feedArtist));
            
            console.log(`  🔄 Data Redundancy:`);
            console.log(`    Unique feed URLs: ${feedUrls.size} (vs ${tracks.length} tracks)`);
            console.log(`    Unique albums: ${feedTitles.size} (vs ${tracks.length} tracks)`);
            console.log(`    Unique artists: ${artists.size} (vs ${tracks.length} tracks)`);
            
            // 2. Check for large fields that could be optimized
            const largeDescriptions = tracks.filter(t => t.description && t.description.length > 500);
            const emptyAudioUrls = tracks.filter(t => !t.enclosureUrl);
            const duplicateImages = tracks.filter((t, i, arr) => 
                t.image && arr.findIndex(other => other.image === t.image) !== i
            );
            
            console.log(`  📝 Large descriptions (>500 chars): ${largeDescriptions.length}`);
            console.log(`  🔇 Tracks without audio URLs: ${emptyAudioUrls.length}`);
            console.log(`  🖼️ Duplicate images: ${duplicateImages.length}`);
            
            // 3. API endpoint analysis
            console.log('\n🌐 API Performance Issues:');
            console.log('  Current issues identified:');
            console.log('  1. Large data files loaded on every API request');
            console.log('  2. Complex deduplication logic runs on each request');
            console.log('  3. Publisher matching logic is computationally expensive');
            console.log('  4. No pagination at database level - all tracks loaded');
            console.log('  5. Heavy JSON parsing on every request');
            
            // 4. Recommendations
            console.log('\n💡 Optimization Recommendations:');
            console.log('  1. Implement database-level pagination');
            console.log('  2. Pre-compute album groupings and cache results');
            console.log('  3. Optimize JSON structure to reduce redundancy');
            console.log('  4. Add compression for API responses');
            console.log('  5. Implement incremental loading for the frontend');
            console.log('  6. Use streaming JSON parsing for large files');
            console.log('  7. Cache publisher mappings separately');
            
            // Create optimized structure suggestion
            console.log('\n🏗️ Suggested Optimizations:');
            
            // Create a more efficient structure
            const optimizedStructure = createOptimizedStructure(tracks);
            
            const originalSize = JSON.stringify(tracks).length;
            const optimizedSize = JSON.stringify(optimizedStructure).length;
            const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
            
            console.log(`  Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Optimized size: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Potential savings: ${savings}%`);
            
            // Write optimization suggestions to file
            const optimizationReport = {
                analysis: {
                    totalTracks: tracks.length,
                    originalSizeMB: originalSize / 1024 / 1024,
                    optimizedSizeMB: optimizedSize / 1024 / 1024,
                    potentialSavings: `${savings}%`,
                    recommendations: [
                        'Implement database-level pagination',
                        'Pre-compute album groupings and cache results',
                        'Optimize JSON structure to reduce redundancy',
                        'Add compression for API responses',
                        'Implement incremental loading for the frontend',
                        'Use streaming JSON parsing for large files',
                        'Cache publisher mappings separately'
                    ]
                },
                optimizedStructure: {
                    example: optimizedStructure.albums?.slice(0, 2) // Just show first 2 as example
                }
            };
            
            const reportPath = path.join(process.cwd(), 'data', `performance-optimization-report-${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(optimizationReport, null, 2));
            console.log(`\n📋 Optimization report saved: ${path.basename(reportPath)}`);
        }
        
        console.log('\n✅ Performance analysis complete!');
        
    } catch (error) {
        console.error('❌ Error during performance analysis:', error);
    }
}

function createOptimizedStructure(tracks) {
    // Group tracks by album to reduce redundancy
    const albumGroups = new Map();
    
    tracks.forEach(track => {
        const albumKey = `${track.feedGuid || 'unknown'}-${track.feedTitle || 'unknown'}`;
        
        if (!albumGroups.has(albumKey)) {
            albumGroups.set(albumKey, {
                id: track.feedGuid,
                title: track.feedTitle,
                artist: track.feedArtist,
                feedUrl: track.feedUrl,
                feedImage: track.feedImage,
                tracks: []
            });
        }
        
        // Add track with minimal data
        albumGroups.get(albumKey).tracks.push({
            title: track.title,
            duration: track.duration,
            enclosureUrl: track.enclosureUrl,
            guid: track.guid,
            // Only include optional fields if they have values
            ...(track.image && track.image !== track.feedImage ? { image: track.image } : {}),
            ...(track.explicit ? { explicit: true } : {}),
            ...(track.description && track.description.length < 200 ? { description: track.description } : {})
        });
    });
    
    return {
        lastUpdated: new Date().toISOString(),
        totalAlbums: albumGroups.size,
        albums: Array.from(albumGroups.values())
    };
}

analyzePerformance();