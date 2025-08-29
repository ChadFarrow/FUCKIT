#!/usr/bin/env node

/**
 * Extract artists from track titles using various fallback patterns
 */

const fs = require('fs');
const path = require('path');

async function fallbackArtistExtraction() {
    try {
        console.log('🔍 Running fallback artist extraction...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Find tracks still missing artists (excluding HGH tracks as they're references)
        const tracksNeedingArtists = musicData.musicTracks.filter(track => 
            (!track.feedArtist || track.feedArtist.trim() === '') &&
            (!track.source || !track.source.includes('HGH')) // Skip HGH references
        );
        
        console.log(`Found ${tracksNeedingArtists.length} tracks needing artist extraction\n`);
        
        if (tracksNeedingArtists.length === 0) {
            console.log('✅ No tracks need artist extraction');
            return;
        }
        
        const extractedTracks = [];
        let extractedCount = 0;
        
        tracksNeedingArtists.forEach(track => {
            const originalIndex = musicData.musicTracks.indexOf(track);
            const extractedArtist = extractArtistFromTrack(track);
            
            if (extractedArtist && extractedArtist !== 'Unknown Artist') {
                const updatedTrack = {
                    ...track,
                    feedArtist: extractedArtist.artist,
                    artistExtractedAt: new Date().toISOString(),
                    extractionMethod: extractedArtist.method,
                    extractionPattern: extractedArtist.pattern
                };
                
                extractedTracks.push({
                    originalIndex,
                    updated: updatedTrack,
                    extracted: extractedArtist
                });
                extractedCount++;
            }
        });
        
        console.log(`📊 Extraction Results:`);
        console.log(`Successfully extracted artists: ${extractedCount} tracks\n`);
        
        // Group by extraction method for analysis
        const methodStats = new Map();
        extractedTracks.forEach(({ extracted }) => {
            const method = extracted.method;
            methodStats.set(method, (methodStats.get(method) || 0) + 1);
        });
        
        console.log('📈 Extraction Methods Used:');
        [...methodStats.entries()].sort((a, b) => b[1] - a[1]).forEach(([method, count]) => {
            console.log(`  ${method}: ${count} tracks`);
        });
        console.log();
        
        if (extractedTracks.length > 0) {
            console.log(`✅ Sample extracted artists:`);
            extractedTracks.slice(0, 15).forEach((item, i) => {
                const track = item.updated;
                console.log(`  ${i + 1}. "${track.title}"`);
                console.log(`     Artist: "${track.feedArtist}" (${track.extractionMethod})`);
                console.log(`     Pattern: ${track.extractionPattern || 'N/A'}`);
                console.log(`     Feed: ${(track.feedUrl || 'N/A').substring(0, 50)}...`);
                console.log();
            });
            
            // Apply extractions to the database
            console.log('💾 Applying artist extractions to database...');
            extractedTracks.forEach(({ originalIndex, updated }) => {
                musicData.musicTracks[originalIndex] = updated;
            });
            
            // Update metadata
            musicData.metadata = {
                ...musicData.metadata,
                lastUpdated: new Date().toISOString(),
                fallbackArtistExtraction: {
                    date: new Date().toISOString(),
                    extractedTracks: extractedCount,
                    totalProcessed: tracksNeedingArtists.length,
                    methodStats: Object.fromEntries(methodStats)
                }
            };
            
            // Create backup
            const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-artist-extraction-${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
            console.log(`📋 Backup created: ${path.basename(backupPath)}`);
            
            // Save updated database
            fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
            console.log('✅ Database updated with extracted artists');
            
        } else {
            console.log('⚠️ No artists were extracted - database not modified');
        }
        
        // Show remaining tracks without artists
        const stillMissingArtists = musicData.musicTracks.filter(track => 
            (!track.feedArtist || track.feedArtist.trim() === '') &&
            (!track.source || !track.source.includes('HGH'))
        );
        
        console.log(`\n📊 Remaining tracks without artists: ${stillMissingArtists.length}`);
        
        if (stillMissingArtists.length > 0 && stillMissingArtists.length <= 20) {
            console.log('\nSample remaining tracks:');
            stillMissingArtists.slice(0, 10).forEach((track, i) => {
                console.log(`  ${i + 1}. "${track.title}" - Album: "${track.feedTitle || '(none)'}"`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error in fallback artist extraction:', error);
    }
}

/**
 * Extract artist from a single track using various patterns
 */
function extractArtistFromTrack(track) {
    const title = track.title || '';
    const feedTitle = track.feedTitle || '';
    const feedUrl = track.feedUrl || '';
    
    // Pattern 1: "Artist - Song" format
    const dashPattern = /^([^-]+)\s*-\s*(.+)$/;
    const dashMatch = title.match(dashPattern);
    if (dashMatch && dashMatch[1].length >= 2 && dashMatch[1].length <= 50) {
        const artist = dashMatch[1].trim();
        if (isValidArtistName(artist)) {
            return {
                artist,
                method: 'dash-pattern',
                pattern: 'Artist - Song'
            };
        }
    }
    
    // Pattern 2: "Song by Artist" format
    const byPattern = /^(.+)\s+by\s+([^(]+)(?:\(.*\))?$/i;
    const byMatch = title.match(byPattern);
    if (byMatch && byMatch[2].length >= 2 && byMatch[2].length <= 50) {
        const artist = byMatch[2].trim();
        if (isValidArtistName(artist)) {
            return {
                artist,
                method: 'by-pattern',
                pattern: 'Song by Artist'
            };
        }
    }
    
    // Pattern 3: "Song feat. Artist" or "Song ft. Artist"
    const featPattern = /^(.+)\s+(?:feat\.?|ft\.?|featuring)\s+([^(]+)(?:\(.*\))?$/i;
    const featMatch = title.match(featPattern);
    if (featMatch && featMatch[2].length >= 2 && featMatch[2].length <= 50) {
        const artist = featMatch[2].trim();
        if (isValidArtistName(artist)) {
            return {
                artist,
                method: 'featuring-pattern',
                pattern: 'Song feat. Artist'
            };
        }
    }
    
    // Pattern 4: Use feed title as artist if it looks like an artist name
    if (feedTitle && feedTitle.trim() && feedTitle.length >= 2 && feedTitle.length <= 50) {
        const cleaned = feedTitle.trim();
        if (isValidArtistName(cleaned) && 
            !cleaned.toLowerCase().includes('untitled') &&
            !cleaned.toLowerCase().includes('podcast') &&
            !cleaned.toLowerCase().includes('episode') &&
            !cleaned.toLowerCase().includes('track ')) {
            return {
                artist: cleaned,
                method: 'feed-title',
                pattern: 'Album/Feed Title'
            };
        }
    }
    
    // Pattern 5: Extract from URL patterns
    if (feedUrl) {
        // Doerfel domain pattern
        if (feedUrl.includes('doerfelverse.com')) {
            const doerfelMatch = feedUrl.match(/feeds\/(.+)\.xml/);
            if (doerfelMatch) {
                const artist = doerfelMatch[1].replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                return {
                    artist: `The Doerfels`,
                    method: 'url-pattern',
                    pattern: 'Doerfelverse URL'
                };
            }
        }
        
        // JustCast pattern
        if (feedUrl.includes('feed.justcast.com')) {
            const justcastMatch = feedUrl.match(/shows\/([^/]+)/);
            if (justcastMatch) {
                const showName = justcastMatch[1].replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                return {
                    artist: showName,
                    method: 'url-pattern',
                    pattern: 'JustCast URL'
                };
            }
        }
    }
    
    // Pattern 6: Clean up title if it has parentheses with potential artist info
    const parenPattern = /^(.+)\s*\(([^)]+)\)$/;
    const parenMatch = title.match(parenPattern);
    if (parenMatch && parenMatch[2].length >= 2 && parenMatch[2].length <= 50) {
        const potentialArtist = parenMatch[2].trim();
        if (isValidArtistName(potentialArtist) && 
            !potentialArtist.toLowerCase().includes('demo') &&
            !potentialArtist.toLowerCase().includes('live') &&
            !potentialArtist.toLowerCase().includes('remix')) {
            return {
                artist: potentialArtist,
                method: 'parentheses-pattern',
                pattern: 'Song (Artist)'
            };
        }
    }
    
    return null;
}

/**
 * Check if a string looks like a valid artist name
 */
function isValidArtistName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const cleaned = name.trim();
    if (cleaned.length < 2 || cleaned.length > 50) return false;
    
    // Exclude common non-artist patterns
    const invalidPatterns = [
        /^track\s*\d+/i,
        /^episode\s*\d+/i,
        /^untitled/i,
        /^unknown/i,
        /^n\/a$/i,
        /^none$/i,
        /^various$/i,
        /^podcast/i,
        /^\d+$/,
        /^[^a-zA-Z]*$/
    ];
    
    for (const pattern of invalidPatterns) {
        if (pattern.test(cleaned)) return false;
    }
    
    return true;
}

// Run the extraction
fallbackArtistExtraction();