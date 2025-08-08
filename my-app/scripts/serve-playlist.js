#!/usr/bin/env node

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 9999;

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/playlist/doerfel-verse-music') {
    try {
      const playlistPath = join(__dirname, '..', 'playlists', 'doerfel-verse-lightning-style-playlist.xml');
      const content = await readFile(playlistPath, 'utf8');
      
      res.writeHead(200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(content);
    } catch (error) {
      console.error('Error reading playlist:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Playlist not found' }));
    }
  } else if (req.url === '/demo' || req.url === '/') {
    try {
      const demoPath = join(__dirname, '..', 'playlists', 'demo.html');
      const content = await readFile(demoPath, 'utf8');
      
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(content);
    } catch (error) {
      console.error('Error reading demo page:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Demo page not found' }));
    }
  } else if (req.url === '/advanced') {
    try {
      const advancedPath = join(__dirname, '..', 'playlists', 'advanced-demo.html');
      const content = await readFile(advancedPath, 'utf8');
      
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(content);
    } catch (error) {
      console.error('Error reading advanced demo page:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Advanced demo page not found' }));
    }
  } else if (req.url === '/playlist/ultra-simple') {
    try {
      const playlistPath = join(__dirname, '..', 'playlists', 'doerfel-verse-ultra-simple-playlist.xml');
      const content = await readFile(playlistPath, 'utf8');
      
      res.writeHead(200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(content);
    } catch (error) {
      console.error('Error reading ultra-simple playlist:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ultra-simple playlist not found' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🎵 Playlist server running at http://localhost:${PORT}`);
  console.log(`📡 RSS Feed: http://localhost:${PORT}/playlist/doerfel-verse-music`);
  console.log(`🎯 Ultra-Simple RSS: http://localhost:${PORT}/playlist/ultra-simple`);
  console.log(`🎨 Demo Page: http://localhost:${PORT}/demo`);
  console.log(`🚀 Advanced Demo: http://localhost:${PORT}/advanced`);
  console.log(`🌐 You can now click these links or subscribe to the RSS feed in your podcast app!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down playlist server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 