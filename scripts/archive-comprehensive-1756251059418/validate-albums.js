#!/usr/bin/env node

/**
 * Album Validation Script
 * Checks all albums for potential issues like NaN values, invalid durations, etc.
 */

const fs = require('fs');
const path = require('path');

function validateAlbums() {
  console.log('🔍 Validating all albums for potential issues...\n');
  
  try {
    // Read parsed feeds data
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const data = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    let totalAlbums = 0;
    let validAlbums = 0;
    let issuesFound = 0;
    const issues = [];
    
    data.feeds.forEach((feed, index) => {
      if (feed.parseStatus === 'success' && feed.parsedData?.album) {
        totalAlbums++;
        const album = feed.parsedData.album;
        let albumValid = true;
        const albumIssues = [];
        
        // Check album title
        if (!album.title || typeof album.title !== 'string') {
          albumIssues.push('Missing or invalid title');
          albumValid = false;
        }
        
        // Check artist
        if (!album.artist || typeof album.artist !== 'string') {
          albumIssues.push('Missing or invalid artist');
          albumValid = false;
        }
        
        // Check tracks array
        if (!Array.isArray(album.tracks)) {
          albumIssues.push('Tracks is not an array');
          albumValid = false;
        } else if (album.tracks.length === 0) {
          albumIssues.push('Empty tracks array');
          albumValid = false;
        } else {
          // Validate each track
          album.tracks.forEach((track, trackIndex) => {
            // Check track title
            if (!track.title || typeof track.title !== 'string') {
              albumIssues.push(`Track ${trackIndex + 1}: Missing or invalid title`);
              albumValid = false;
            }
            
            // Check track duration
            if (!track.duration || typeof track.duration !== 'string') {
              albumIssues.push(`Track ${trackIndex + 1}: Missing or invalid duration`);
              albumValid = false;
            } else if (track.duration === 'NaN' || track.duration === 'undefined' || track.duration === 'null') {
              albumIssues.push(`Track ${trackIndex + 1}: Invalid duration value: ${track.duration}`);
              albumValid = false;
            } else if (!track.duration.includes(':')) {
              albumIssues.push(`Track ${trackIndex + 1}: Duration not in MM:SS format: ${track.duration}`);
              albumValid = false;
            }
            
            // Check track URL
            if (!track.url || typeof track.url !== 'string') {
              albumIssues.push(`Track ${trackIndex + 1}: Missing or invalid URL`);
              albumValid = false;
            }
          });
        }
        
        if (albumValid) {
          validAlbums++;
        } else {
          issuesFound++;
          issues.push({
            album: album.title,
            artist: album.artist,
            issues: albumIssues
          });
        }
      }
    });
    
    // Print results
    console.log(`📊 Validation Results:`);
    console.log(`   Total albums: ${totalAlbums}`);
    console.log(`   Valid albums: ${validAlbums}`);
    console.log(`   Albums with issues: ${issuesFound}`);
    console.log(`   Success rate: ${((validAlbums / totalAlbums) * 100).toFixed(1)}%\n`);
    
    if (issues.length > 0) {
      console.log('⚠️  Issues found:');
      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.album} by ${issue.artist}`);
        issue.issues.forEach(problem => {
          console.log(`   - ${problem}`);
        });
      });
    } else {
      console.log('✅ All albums are valid! No issues found.');
    }
    
    // Check for specific problematic patterns
    console.log('\n🔍 Checking for specific patterns...');
    
    const content = fs.readFileSync(parsedFeedsPath, 'utf8');
    const patterns = [
      { name: 'NaN values', pattern: /"NaN"/g },
      { name: 'undefined values', pattern: /"undefined"/g },
      { name: 'null values', pattern: /"null"/g },
      { name: 'empty duration', pattern: /"duration": ""/g },
      { name: 'empty tracks array', pattern: /"tracks": \[\]/g }
    ];
    
    patterns.forEach(({ name, pattern }) => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`   ⚠️  Found ${matches.length} instances of ${name}`);
      } else {
        console.log(`   ✅ No ${name} found`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error validating albums:', error);
    process.exit(1);
  }
}

// Run validation
validateAlbums(); 