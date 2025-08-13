#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function replaceSVGDirectly() {
  console.log('🎨 Replacing SVG content directly in parsed-feeds.json...');
  
  const parsedFeedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
  const backupPath = path.join(__dirname, '..', 'data', 'parsed-feeds-backup-before-direct-replace.json');
  
  // Create backup
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(parsedFeedsPath, backupPath);
    console.log('📋 Created backup:', backupPath);
  }
  
  // Read the file as a string
  let content = fs.readFileSync(parsedFeedsPath, 'utf8');
  
  // Create the new simple SVG
  const newSVG = '<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1e40af"/><text x="150" y="150" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">At Your Cervix</text></svg>';
  const newDataURL = `data:image/svg+xml;base64,${Buffer.from(newSVG).toString('base64')}`;
  
  console.log(`📏 New SVG length: ${newSVG.length} characters`);
  console.log(`📏 New data URL length: ${newDataURL.length} characters`);
  
  // Find and replace the old SVG
  const oldPattern = /"coverArt": "data:image\/svg\+xml;base64,[^"]*"/;
  const newCoverArt = `"coverArt": "${newDataURL}"`;
  
  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newCoverArt);
    console.log('✅ Replaced coverArt field');
  } else {
    console.log('❌ Could not find coverArt field to replace');
    return;
  }
  
  // Also replace track images
  const trackImagePattern = /"image": "data:image\/svg\+xml;base64,[^"]*"/g;
  const newTrackImage = `"image": "${newDataURL}"`;
  
  const trackMatches = content.match(trackImagePattern);
  if (trackMatches) {
    content = content.replace(trackImagePattern, newTrackImage);
    console.log(`✅ Replaced ${trackMatches.length} track image fields`);
  }
  
  // Write the updated content
  fs.writeFileSync(parsedFeedsPath, content);
  
  console.log('\n✅ Successfully updated parsed-feeds.json!');
  console.log(`📁 Database updated: ${parsedFeedsPath}`);
}

// Run the replacement
replaceSVGDirectly().catch(console.error);
