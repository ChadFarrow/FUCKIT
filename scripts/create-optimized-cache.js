#!/usr/bin/env node

/**
 * Create pre-computed album cache to speed up main page loading
 * This addresses the 3.26 MB database processing issue
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateAlbumSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

async function createOptimizedCache() {
    console.log('🚀 Creating Optimized Album Cache\n');
    console.log('=' .repeat(50));
    
    try {
        // Load music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        const tracks = musicData.musicTracks || [];
        
        console.log(`📊 Processing ${tracks.length} tracks...`);
        
        // Group tracks by album (feedGuid + feedTitle)
        const albumGroups = new Map();
        
        tracks.forEach(track => {
            const key = track.feedGuid || `${track.feedTitle}-${track.feedArtist}`;
            
            if (!albumGroups.has(key)) {
                albumGroups.set(key, {
                    feedGuid: track.feedGuid,
                    feedTitle: track.feedTitle,
                    feedArtist: track.feedArtist,
                    feedUrl: track.feedUrl,
                    feedImage: track.feedImage || track.image,
                    tracks: []
                });
            }
            
            albumGroups.get(key).tracks.push(track);
        });
        
        console.log(`📦 Grouped into ${albumGroups.size} albums`);
        
        // Convert to optimized album format
        const optimizedAlbums = Array.from(albumGroups.values()).map(group => {
            // Filter out HGH reference albums
            if (group.feedTitle && group.feedTitle.includes('Music Reference from Homegrown Hits')) {
                return null;
            }
            
            // Create optimized album structure
            const firstTrack = group.tracks[0];
            const albumTitle = group.feedTitle || 'Unknown Album';
            
            // Artist mapping for complex cases
            const artistMappings = {
                'Everything Is Lit': 'Fletcher and Blaney',
                'Stay Awhile': 'Able and the Wolf',
                'The HeyCitizen Experience': 'HeyCitizen',
                'Music From The Doerfel-Verse': 'Various Artists',
                'Homegrown Hits Vol. I': 'Various Artists'
            };
            
            let artist = artistMappings[albumTitle] || group.feedArtist || 'Unknown Artist';
            
            // Deduplicate tracks within album
            const uniqueTracks = group.tracks.filter((track, index, array) => {
                const title = track.title || 'Untitled';
                const sameTitle = array.filter(t => (t.title || 'Untitled') === title);
                
                if (sameTitle.length === 1) return true;
                
                // Prefer tracks with audio URLs
                const withUrl = sameTitle.find(t => t.enclosureUrl && t.enclosureUrl.trim() !== '');
                if (withUrl) return track === withUrl;
                
                // Keep first occurrence
                return array.findIndex(t => (t.title || 'Untitled') === title) === index;
            });
            
            return {
                id: generateAlbumSlug(albumTitle),
                title: albumTitle,
                artist: artist,
                description: firstTrack.description || '',
                coverArt: group.feedImage || firstTrack.image || '',
                releaseDate: new Date(firstTrack.datePublished * 1000 || Date.now()).toISOString(),
                trackCount: uniqueTracks.length,
                tracks: uniqueTracks.map((track, index) => ({
                    title: track.title || 'Untitled',
                    duration: track.duration ? Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0') : '0:00',
                    url: track.enclosureUrl || '',
                    trackNumber: index + 1,
                    explicit: track.explicit || false
                })),
                feedId: group.feedGuid || `music-${generateAlbumSlug(albumTitle)}`,
                feedUrl: group.feedUrl || '',
                lastUpdated: new Date().toISOString()
            };
        }).filter(album => album !== null);
        
        console.log(`✅ Created ${optimizedAlbums.length} optimized albums`);
        
        // Sort albums by type and name
        const sortedAlbums = [
            // Albums (7+ tracks)
            ...optimizedAlbums.filter(album => album.trackCount > 6)
                .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())),
            // EPs (2-6 tracks)
            ...optimizedAlbums.filter(album => album.trackCount > 1 && album.trackCount <= 6)
                .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())),
            // Singles (1 track)
            ...optimizedAlbums.filter(album => album.trackCount === 1)
                .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
        ];
        
        // Create cache structure
        const cacheData = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            sourceTracksCount: tracks.length,
            albums: sortedAlbums,
            totalAlbums: sortedAlbums.length,
            albumsByType: {
                albums: sortedAlbums.filter(a => a.trackCount > 6).length,
                eps: sortedAlbums.filter(a => a.trackCount > 1 && a.trackCount <= 6).length,
                singles: sortedAlbums.filter(a => a.trackCount === 1).length
            },
            checksum: crypto.createHash('md5').update(JSON.stringify(sortedAlbums)).digest('hex')
        };
        
        // Calculate size savings
        const originalSize = JSON.stringify(tracks).length;
        const optimizedSize = JSON.stringify(cacheData).length;
        const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
        
        console.log('\n📊 Optimization Results:');
        console.log(`  Original tracks: ${tracks.length}`);
        console.log(`  Optimized albums: ${sortedAlbums.length}`);
        console.log(`  Albums: ${cacheData.albumsByType.albums}`);
        console.log(`  EPs: ${cacheData.albumsByType.eps}`);
        console.log(`  Singles: ${cacheData.albumsByType.singles}`);
        console.log(`  Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Optimized size: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Size reduction: ${savings}%`);
        
        // Save optimized cache
        const cachePath = path.join(process.cwd(), 'data', 'albums-cache.json');
        fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
        
        console.log(`\n💾 Optimized cache saved: ${cachePath}`);
        console.log(`📝 Cache checksum: ${cacheData.checksum}`);
        
        // Create API endpoint compatible version
        const apiCache = {
            albums: sortedAlbums,
            totalCount: sortedAlbums.length,
            lastUpdated: new Date().toISOString(),
            publisherStats: [], // Will be computed separately if needed
            version: cacheData.version
        };
        
        const apiCachePath = path.join(process.cwd(), 'data', 'albums-api-cache.json');
        fs.writeFileSync(apiCachePath, JSON.stringify(apiCache, null, 2));
        
        console.log(`🌐 API cache saved: ${apiCachePath}`);
        
        console.log('\n✅ Optimization complete! This should significantly speed up the main page.');
        console.log('💡 The /api/albums endpoint can now serve pre-computed data instead of processing 3.26MB on every request.');
        
        return cacheData;
        
    } catch (error) {
        console.error('❌ Error creating optimized cache:', error);
        throw error;
    }
}

createOptimizedCache();