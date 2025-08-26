#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function getAudioDuration(audioUrl) {
    if (!audioUrl || !audioUrl.startsWith('http')) {
        return null;
    }
    
    try {
        console.log(`    🔍 Analyzing audio file: ${audioUrl.substring(0, 60)}...`);
        
        // Make a range request to get just the header portion
        const response = await fetch(audioUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'FUCKIT-Audio-Analyzer/1.0',
                'Accept': 'audio/*'
            }
        });
        
        if (!response.ok) {
            console.log(`    ❌ HTTP ${response.status}: ${response.statusText}`);
            return null;
        }
        
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        const acceptRanges = response.headers.get('accept-ranges');
        
        console.log(`    📄 Content-Type: ${contentType || 'unknown'}`);
        console.log(`    📏 Content-Length: ${contentLength ? Math.round(parseInt(contentLength) / 1024 / 1024) + 'MB' : 'unknown'}`);
        
        if (!contentLength || !contentType?.includes('audio')) {
            console.log(`    ⚠️  Not a valid audio file or no size info`);
            return null;
        }
        
        // Estimate duration based on file size and typical bitrates
        const sizeInMB = parseInt(contentLength) / (1024 * 1024);
        let estimatedDuration = 0;
        
        // Different estimates based on audio format
        if (contentType.includes('mp3')) {
            // MP3: typically 128-320kbps, average ~192kbps = ~1.44MB/minute
            estimatedDuration = Math.round(sizeInMB / 1.44 * 60);
        } else if (contentType.includes('m4a') || contentType.includes('aac')) {
            // AAC: typically 128kbps = ~0.96MB/minute  
            estimatedDuration = Math.round(sizeInMB / 0.96 * 60);
        } else if (contentType.includes('wav')) {
            // WAV: uncompressed, ~10MB/minute
            estimatedDuration = Math.round(sizeInMB / 10 * 60);
        } else if (contentType.includes('flac')) {
            // FLAC: ~6MB/minute
            estimatedDuration = Math.round(sizeInMB / 6 * 60);
        } else {
            // Generic audio: assume MP3-like compression
            estimatedDuration = Math.round(sizeInMB / 1.5 * 60);
        }
        
        // Sanity check: should be between 30 seconds and 30 minutes for music
        if (estimatedDuration < 30 || estimatedDuration > 1800) {
            console.log(`    ⚠️  Estimated duration ${estimatedDuration}s seems unrealistic`);
            return null;
        }
        
        console.log(`    ✅ Estimated duration: ${Math.floor(estimatedDuration / 60)}:${String(estimatedDuration % 60).padStart(2, '0')}`);
        
        return {
            duration: estimatedDuration,
            fileSize: parseInt(contentLength),
            contentType: contentType,
            method: 'size-estimation'
        };
        
    } catch (error) {
        console.log(`    ❌ Error analyzing audio: ${error.message}`);
        return null;
    }
}

async function extractAudioMetadata() {
    console.log('🎧 Audio Metadata Extraction for Missing Duration\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-audio-analysis-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks missing duration that have audio URLs
    const tracksToAnalyze = musicData.musicTracks.filter(track => 
        (!track.duration || track.duration === 0) &&
        track.audioUrl && 
        track.audioUrl.startsWith('http')
    );
    
    console.log(`Found ${tracksToAnalyze.length} tracks with audio URLs but missing duration\n`);
    
    if (tracksToAnalyze.length === 0) {
        console.log('✅ No tracks with audio URLs need duration analysis');
        return;
    }
    
    let analyzedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    // Process each track
    for (const [index, track] of tracksToAnalyze.entries()) {
        console.log(`🎵 [${index + 1}/${tracksToAnalyze.length}] "${track.title}" by ${track.artist}`);
        
        const audioMeta = await getAudioDuration(track.audioUrl);
        
        if (audioMeta && audioMeta.duration) {
            track.duration = audioMeta.duration;
            track.audioAnalysis = {
                method: audioMeta.method,
                fileSize: audioMeta.fileSize,
                contentType: audioMeta.contentType,
                analyzedDate: new Date().toISOString()
            };
            
            successCount++;
            console.log(`    ✅ Updated duration: ${audioMeta.duration} seconds\n`);
        } else {
            failedCount++;
            console.log(`    ❌ Could not determine duration\n`);
        }
        
        analyzedCount++;
        
        // Save progress every 5 tracks
        if (analyzedCount % 5 === 0) {
            musicData.metadata.lastUpdated = new Date().toISOString();
            fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
            console.log(`    💾 Progress saved (${successCount} successful so far)\n`);
        }
        
        // Rate limiting to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final save
    musicData.metadata.lastAudioAnalysis = {
        date: new Date().toISOString(),
        tracksAnalyzed: analyzedCount,
        successful: successCount,
        failed: failedCount,
        source: 'Audio File Duration Analysis'
    };
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('=' .repeat(60));
    console.log('📊 Audio Analysis Summary:');
    console.log(`  🎯 Tracks analyzed: ${analyzedCount}`);
    console.log(`  ✅ Successfully extracted duration: ${successCount}`);
    console.log(`  ❌ Failed to extract: ${failedCount}`);
    console.log(`  📈 Success rate: ${(successCount/analyzedCount*100).toFixed(1)}%`);
    
    console.log('\n✨ Audio metadata extraction complete!');
    if (successCount > 0) {
        console.log(`⏱️  ${successCount} tracks now have estimated durations based on file size.`);
    }
}

// Run the extraction
extractAudioMetadata().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});