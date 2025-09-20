#!/usr/bin/env node

/**
 * Refresh all feeds in the PostgreSQL database
 * This script calls the API endpoints to re-parse all RSS feeds
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function refreshFeed(feedId, feedUrl) {
    try {
        const response = await fetch(`http://localhost:3000/api/feeds/${feedId}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return { success: true, ...result };
        } else {
            return { success: false, error: result.error || 'Unknown error' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function refreshAllFeeds() {
    try {
        console.log('🔄 Database Feed Refresh System\n');
        console.log('=' .repeat(50));
        
        // Get all feeds from database
        const feeds = await prisma.feed.findMany({
            select: {
                id: true,
                originalUrl: true,
                title: true,
                type: true,
                status: true,
                lastFetched: true,
                _count: {
                    select: { tracks: true }
                }
            },
            orderBy: [
                { priority: 'asc' },
                { createdAt: 'asc' }
            ]
        });
        
        console.log(`📊 Found ${feeds.length} feeds in database\n`);
        
        // Show current status
        const activeFeeds = feeds.filter(f => f.status === 'active');
        const errorFeeds = feeds.filter(f => f.status === 'error');
        console.log(`  ✅ Active: ${activeFeeds.length}`);
        console.log(`  ❌ Error: ${errorFeeds.length}`);
        console.log(`  📀 Total tracks: ${feeds.reduce((sum, f) => sum + f._count.tracks, 0)}\n`);
        
        console.log('Starting refresh process...\n');
        
        let successCount = 0;
        let failCount = 0;
        let newTracksTotal = 0;
        const errors = [];
        
        for (let i = 0; i < feeds.length; i++) {
            const feed = feeds[i];
            const progress = `[${i + 1}/${feeds.length}]`;
            
            console.log(`${progress} Refreshing: ${feed.title || feed.originalUrl}`);
            console.log(`  📡 URL: ${feed.originalUrl}`);
            console.log(`  📀 Current tracks: ${feed._count.tracks}`);
            
            const result = await refreshFeed(feed.id, feed.originalUrl);
            
            if (result.success) {
                successCount++;
                const newTracks = result.newTracks || 0;
                newTracksTotal += newTracks;
                const totalTracks = result.feed?._count?.tracks || feed._count.tracks;
                console.log(`  ✅ Success! New tracks: ${newTracks}, Total: ${totalTracks}`);
            } else {
                failCount++;
                errors.push({ feed: feed.title || feed.originalUrl, error: result.error });
                console.log(`  ❌ Failed: ${result.error}`);
            }
            
            console.log('');
            
            // Rate limiting - longer delay for Wavlake
            if (feed.originalUrl.includes('wavlake.com')) {
                await delay(2000); // 2 second delay for Wavlake
            } else {
                await delay(500); // 500ms for others
            }
        }
        
        // Final summary
        console.log('=' .repeat(50));
        console.log('📊 Refresh Complete!\n');
        console.log(`  ✅ Successful: ${successCount}/${feeds.length}`);
        console.log(`  ❌ Failed: ${failCount}/${feeds.length}`);
        console.log(`  🎵 New tracks added: ${newTracksTotal}`);
        
        // Get final track count
        const finalTrackCount = await prisma.track.count();
        console.log(`  📀 Total tracks in database: ${finalTrackCount}`);
        
        // Show errors if any
        if (errors.length > 0) {
            console.log('\n⚠️ Failed feeds:');
            errors.slice(0, 10).forEach(e => {
                console.log(`  - ${e.feed}: ${e.error}`);
            });
            if (errors.length > 10) {
                console.log(`  ... and ${errors.length - 10} more`);
            }
        }
        
        console.log('\n✨ Database refresh completed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Check if server is running
async function checkServer() {
    try {
        const response = await fetch('http://localhost:3000/api/health');
        if (!response.ok) {
            throw new Error('Server not responding');
        }
        return true;
    } catch (error) {
        console.error('❌ Server is not running!');
        console.error('Please start the development server first:');
        console.error('  npm run dev');
        return false;
    }
}

// Main execution
async function main() {
    console.log('🔍 Checking server status...');
    
    const serverRunning = await checkServer();
    if (!serverRunning) {
        process.exit(1);
    }
    
    console.log('✅ Server is running\n');
    console.log('⚠️  WARNING: This will refresh all RSS feeds in the database!');
    console.log('This may take several minutes depending on the number of feeds.\n');
    console.log('Starting in 3 seconds... (Ctrl+C to cancel)');
    
    await delay(3000);
    await refreshAllFeeds();
}

main().catch(console.error);