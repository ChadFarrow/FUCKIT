#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createOptimizedCache() {
  console.log('🚀 Creating optimized album cache...');
  
  try {
    // Get all active feeds with their tracks in a single optimized query
    const feeds = await prisma.feed.findMany({
      where: { status: 'active' },
      include: {
        tracks: {
          where: {
            audioUrl: { not: '' }
          },
          orderBy: [
            { publishedAt: 'desc' },
            { createdAt: 'desc' }
          ],
          take: 50 // Limit tracks per feed for performance
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 200
    });
    
    console.log(`📊 Loaded ${feeds.length} feeds with tracks`);
    
    // Transform feeds into albums
    const albums = [];
    const publisherStats = [];
    
    for (const feed of feeds) {
      if (feed.tracks.length === 0) continue;
      
      // Create album from feed
      const album = {
        id: feed.id,
        title: feed.title,
        artist: feed.artist || feed.title,
        description: feed.description || '',
        coverArt: feed.image || '',
        releaseDate: feed.updatedAt || feed.createdAt,
        feedUrl: feed.originalUrl,
        feedGuid: feed.id,
        priority: feed.priority,
        tracks: feed.tracks.map(track => ({
          id: track.id,
          title: track.title,
          duration: track.duration,
          url: track.audioUrl,
          publishedAt: track.publishedAt,
          guid: track.guid
        }))
      };
      
      albums.push(album);
      
      // Track publisher stats
      const existingPublisher = publisherStats.find(p => p.name === feed.artist);
      if (existingPublisher) {
        existingPublisher.albumCount++;
      } else {
        publisherStats.push({
          name: feed.artist || feed.title,
          feedGuid: feed.id,
          albumCount: 1
        });
      }
    }
    
    // Sort albums by priority and release date
    albums.sort((a, b) => {
      const priorityOrder = { 'core': 1, 'high': 2, 'normal': 3, 'low': 4 };
      const aPriority = priorityOrder[a.priority] || 5;
      const bPriority = priorityOrder[b.priority] || 5;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return new Date(b.releaseDate) - new Date(a.releaseDate);
    });
    
    // Create cache object
    const cacheData = {
      albums,
      publisherStats,
      totalAlbums: albums.length,
      totalPublishers: publisherStats.length,
      createdAt: new Date().toISOString(),
      version: 'v1'
    };
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write cache file
    const cachePath = path.join(dataDir, 'albums-api-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    
    console.log(`✅ Created optimized cache with ${albums.length} albums and ${publisherStats.length} publishers`);
    console.log(`📁 Cache saved to: ${cachePath}`);
    
  } catch (error) {
    console.error('❌ Error creating optimized cache:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createOptimizedCache();
}

module.exports = { createOptimizedCache };