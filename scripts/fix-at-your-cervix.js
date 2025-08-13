#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate a simple SVG placeholder as a data URL
function generatePlaceholderSVG(title, artist) {
  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <g transform="translate(150, 150)" fill="white" opacity="0.9">
        <!-- Music note icon -->
        <circle cx="0" cy="-45" r="24" fill="white"/>
        <rect x="-6" y="-45" width="12" height="120" fill="white"/>
        <circle cx="0" cy="75" r="24" fill="white"/>
        <rect x="-6" cy="75" width="12" height="60" fill="white"/>
      </g>
      <text x="150" y="250" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
        ${title}
      </text>
      ${artist && artist !== title ? `<text x="150" y="270" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12">${artist}</text>` : ''}
    </svg>
  `;
  
  // Convert to data URL
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function fixAtYourCervix() {
  console.log('🎨 Fixing At Your Cervix album artwork...');
  
  const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
  const backupPath = path.join(__dirname, '..', 'data', 'parsed-feeds-backup-before-cervix-fix.json');
  
  // Create backup
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(parsedFeedsPath, backupPath);
    console.log('📋 Created backup:', backupPath);
  }
  
  const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
  const feeds = parsedFeedsData.feeds;
  
  let found = false;
  
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    
    if (feed.parseStatus === 'success' && 
        feed.parsedData?.album?.title === 'At Your Cervix') {
      
      console.log(`✅ Found "At Your Cervix" album at index ${i}`);
      
      const album = feed.parsedData.album;
      const oldCoverArt = album.coverArt;
      
      // Generate new SVG placeholder
      const newCoverArt = generatePlaceholderSVG(album.title, album.artist);
      
      // Update the album coverArt
      feeds[i].parsedData.album.coverArt = newCoverArt;
      
      // Update all track images to use the new coverArt
      if (album.tracks && Array.isArray(album.tracks)) {
        for (let j = 0; j < album.tracks.length; j++) {
          feeds[i].parsedData.album.tracks[j].image = newCoverArt;
        }
        console.log(`📝 Updated ${album.tracks.length} track images`);
      }
      
      console.log(`🔄 Replaced coverArt from: ${oldCoverArt.substring(0, 50)}...`);
      console.log(`🔄 To: ${newCoverArt.substring(0, 50)}...`);
      
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log('❌ Could not find "At Your Cervix" album');
    return;
  }
  
  // Save updated feeds
  parsedFeedsData.feeds = feeds;
  fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
  
  console.log('\n✅ Successfully updated "At Your Cervix" album artwork!');
  console.log(`📁 Database updated: ${parsedFeedsPath}`);
}

// Run the fix
fixAtYourCervix().catch(console.error);
