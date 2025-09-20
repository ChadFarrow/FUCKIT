#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Static playlist data from your app/playlist/index/page.tsx
const staticPlaylists = [
  {
    id: 'itdv',
    name: 'Into The Doerfel-Verse',
    description: 'Music from Into The Doerfel-Verse podcast episodes',
    feedUrl: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
    rssUrl: 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/ITDV-music-playlist.xml',
    image: 'https://www.doerfelverse.com/art/itdvchadf.png',
    isPublic: true,
    createdBy: 'system',
    type: 'podcast-music'
  },
  {
    id: 'hgh',
    name: 'Homegrown Hits',
    description: 'Music from Homegrown Hits podcast',
    feedUrl: 'https://feed.homegrownhits.xyz/feed.xml',
    rssUrl: 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml',
    image: 'https://homegrownhits.xyz/art/hgh-logo.png',
    isPublic: true,
    createdBy: 'system',
    type: 'podcast-music'
  },
  {
    id: 'lightning-thrashes',
    name: 'Lightning Thrashes',
    description: 'Music from Lightning Thrashes podcast',
    feedUrl: 'https://lightninthrashes.com/feed.xml',
    rssUrl: 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/Lightning-Thrashes-music-playlist.xml',
    image: 'https://cdn.kolomona.com/podcasts/lightning-thrashes/060/060-Lightning-Thrashes-1000.jpg',
    isPublic: true,
    createdBy: 'system',
    type: 'podcast-music'
  },
  {
    id: 'top100-music',
    name: 'Top 100 Music',
    description: 'Curated collection of top music tracks',
    feedUrl: '',
    rssUrl: '',
    image: '',
    isPublic: true,
    createdBy: 'system',
    type: 'curated'
  },
  {
    id: 'upbeats',
    name: 'UpBEATs',
    description: 'UpBEATs music playlist',
    feedUrl: '',
    rssUrl: '',
    image: '',
    isPublic: true,
    createdBy: 'system',
    type: 'curated'
  }
];

async function migrateStaticPlaylists() {
  console.log('🚀 Starting migration of static playlists to PostgreSQL database...');
  
  try {
    for (const playlistData of staticPlaylists) {
      console.log(`📝 Creating playlist: ${playlistData.name}`);
      
      // Check if playlist already exists
      const existingPlaylist = await prisma.userPlaylist.findFirst({
        where: {
          OR: [
            { name: playlistData.name },
            { id: playlistData.id }
          ]
        }
      });
      
      if (existingPlaylist) {
        console.log(`⚠️  Playlist "${playlistData.name}" already exists, skipping...`);
        continue;
      }
      
      // Create the playlist
      const playlist = await prisma.userPlaylist.create({
        data: {
          id: playlistData.id,
          name: playlistData.name,
          description: playlistData.description,
          isPublic: playlistData.isPublic,
          createdBy: playlistData.createdBy,
          image: playlistData.image || null
        }
      });
      
      console.log(`✅ Created playlist: ${playlist.name} (ID: ${playlist.id})`);
      
      // If this playlist has tracks from a feed, we can optionally populate it
      if (playlistData.feedUrl) {
        console.log(`🔗 Playlist "${playlistData.name}" is linked to feed: ${playlistData.feedUrl}`);
        console.log(`📡 RSS feed available at: ${playlistData.rssUrl}`);
      }
    }
    
    // Get final count
    const totalPlaylists = await prisma.userPlaylist.count();
    console.log(`\n🎉 Migration completed! Total playlists in database: ${totalPlaylists}`);
    
    // List all playlists
    const allPlaylists = await prisma.userPlaylist.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('\n📋 All playlists in database:');
    allPlaylists.forEach(playlist => {
      console.log(`  - ${playlist.name} (${playlist.isPublic ? 'Public' : 'Private'}) - ${playlist.description}`);
    });
    
  } catch (error) {
    console.error('❌ Error migrating playlists:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  migrateStaticPlaylists();
}

module.exports = { migrateStaticPlaylists };
