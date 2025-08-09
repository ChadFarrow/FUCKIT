#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Add a few sample tracks manually to demonstrate the working system
function addSampleTracks() {
  console.log('🎵 Adding sample HGH tracks to demonstrate functionality...');
  
  // Add some sample audio URLs (these are just examples to show the format)
  const sampleAudioUrls = {
    'Track 1': 'https://example.com/hgh-track-1.mp3',
    'Track 2': 'https://example.com/hgh-track-2.mp3', 
    'Track 3': 'https://example.com/hgh-track-3.mp3'
  };
  
  const sampleArtworkUrls = {
    'Track 1': 'https://example.com/hgh-artwork-1.jpg',
    'Track 2': 'https://example.com/hgh-artwork-2.jpg',
    'Track 3': 'https://example.com/hgh-artwork-3.jpg'
  };
  
  // Update audio URLs file
  const audioUrlsPath = path.join(__dirname, '..', 'data', 'hgh-audio-urls.ts');
  const audioUrlsContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Sample entries added to demonstrate functionality
// Once Podcast Index API rate limits reset, these will be replaced with real resolved URLs
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = ${JSON.stringify(sampleAudioUrls, null, 2)};
`;
  fs.writeFileSync(audioUrlsPath, audioUrlsContent);
  console.log('✅ Updated hgh-audio-urls.ts with sample tracks');
  
  // Update artwork URLs file
  const artworkUrlsPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
  const artworkUrlsContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Sample entries added to demonstrate functionality  
// Once Podcast Index API rate limits reset, these will be replaced with real resolved URLs
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = ${JSON.stringify(sampleArtworkUrls, null, 2)};
`;
  fs.writeFileSync(artworkUrlsPath, artworkUrlsContent);
  console.log('✅ Updated hgh-artwork-urls.ts with sample tracks');
  
  console.log('\n🎉 Sample tracks added!');
  console.log('🌐 Reload http://localhost:3001/playlist/hgh-rss to see "3 with audio"');
  console.log('\n📝 Note: These are placeholder URLs to demonstrate the system works.');
  console.log('   Real URLs will be populated when API rate limits reset.');
}

addSampleTracks();