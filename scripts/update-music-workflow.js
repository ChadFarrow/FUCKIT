#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎵 FUCKIT Music Update Workflow');
console.log('=' .repeat(60));
console.log('Running comprehensive update after adding new music...\n');

async function runWorkflow() {
  const startTime = Date.now();
  let totalSteps = 0;
  let completedSteps = 0;
  let errors = [];

  try {
    // Step 1: Discover new Wavlake publisher feeds
    console.log('📡 STEP 1: Discovering new Wavlake publisher feeds...');
    console.log('-' .repeat(50));
    totalSteps++;
    
    try {
      execSync('node scripts/discover-wavlake-publisher-feeds.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      completedSteps++;
      console.log('✅ Publisher feed discovery completed\n');
    } catch (error) {
      errors.push('Publisher feed discovery failed: ' + error.message);
      console.error('❌ Publisher feed discovery failed\n');
    }

    // Step 2: Check for missing track artwork
    console.log('🎨 STEP 2: Checking for missing individual track artwork...');
    console.log('-' .repeat(50));
    totalSteps++;
    
    try {
      execSync('node scripts/check-missing-track-artwork.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      completedSteps++;
      console.log('✅ Track artwork check completed\n');
    } catch (error) {
      errors.push('Track artwork check failed: ' + error.message);
      console.error('❌ Track artwork check failed\n');
    }

    // Step 3: Fix album artwork issues
    console.log('🖼️  STEP 3: Fixing album artwork...');
    console.log('-' .repeat(50));
    totalSteps++;
    
    try {
      execSync('node scripts/fix-all-album-artwork.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      completedSteps++;
      console.log('✅ Album artwork fix completed\n');
    } catch (error) {
      errors.push('Album artwork fix failed: ' + error.message);
      console.error('❌ Album artwork fix failed\n');
    }

    // Step 4: Comprehensive artwork verification
    console.log('🔍 STEP 4: Running comprehensive artwork verification...');
    console.log('-' .repeat(50));
    totalSteps++;
    
    try {
      execSync('node scripts/check-all-artwork-comprehensive.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      completedSteps++;
      console.log('✅ Comprehensive artwork check completed\n');
    } catch (error) {
      errors.push('Comprehensive artwork check failed: ' + error.message);
      console.error('❌ Comprehensive artwork check failed\n');
    }

    // Step 5: Integrate publisher feeds into albums
    console.log('🔗 STEP 5: Integrating publisher feeds into albums...');
    console.log('-' .repeat(50));
    totalSteps++;
    
    try {
      execSync('node scripts/integrate-publisher-feeds.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      completedSteps++;
      console.log('✅ Publisher feed integration completed\n');
    } catch (error) {
      errors.push('Publisher feed integration failed: ' + error.message);
      console.error('❌ Publisher feed integration failed\n');
    }

    // Step 6: Rebuild parsed feeds from tracks (if needed)
    console.log('🔄 STEP 6: Rebuilding parsed feeds from tracks...');
    console.log('-' .repeat(50));
    totalSteps++;
    
    try {
      execSync('node scripts/rebuild-parsed-feeds-from-tracks.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      completedSteps++;
      console.log('✅ Parsed feeds rebuild completed\n');
    } catch (error) {
      errors.push('Parsed feeds rebuild failed: ' + error.message);
      console.error('❌ Parsed feeds rebuild failed\n');
    }

    // Final Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('=' .repeat(60));
    console.log('🏁 FUCKIT MUSIC UPDATE WORKFLOW COMPLETE');
    console.log('=' .repeat(60));
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Steps completed: ${completedSteps}/${totalSteps}`);
    
    if (errors.length === 0) {
      console.log('🎉 All steps completed successfully!');
      console.log('✅ Your music database is now fully updated with:');
      console.log('   • All new publisher feeds discovered');
      console.log('   • All artwork verified and fixed');
      console.log('   • All feeds properly parsed and structured');
      console.log('   • Comprehensive coverage verification complete');
    } else {
      console.log(`⚠️  ${errors.length} step(s) had issues:`);
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log('\n💡 Check the logs above for details on any failures');
    }

    // Database statistics
    try {
      const musicData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/music-tracks.json'), 'utf8'));
      const parsedData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/parsed-feeds.json'), 'utf8'));
      const publisherData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/publisher-feed-results.json'), 'utf8'));
      
      console.log('\n📈 UPDATED DATABASE STATISTICS:');
      console.log(`🎵 Total tracks: ${musicData.musicTracks?.length || 0}`);
      console.log(`💿 Total albums: ${parsedData.feeds?.length || 0}`);
      console.log(`🏢 Total publisher feeds: ${publisherData?.length || 0}`);
      console.log(`📅 Last updated: ${new Date().toISOString()}`);
      
    } catch (error) {
      console.log('\n⚠️  Could not load database statistics');
    }

    console.log('\n🚀 Your FUCKIT music system is ready!');

  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
    process.exit(1);
  }
}

// Helper function to check if this is being run after adding new music
function checkForNewMusic() {
  const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
  
  if (!fs.existsSync(musicTracksPath)) {
    console.log('⚠️  No music-tracks.json found. Add some music first!');
    return false;
  }
  
  try {
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    const trackCount = musicData.musicTracks?.length || 0;
    
    if (trackCount === 0) {
      console.log('⚠️  No tracks found in database. Add some music first!');
      return false;
    }
    
    console.log(`🎵 Found ${trackCount} tracks in database. Running update workflow...\n`);
    return true;
    
  } catch (error) {
    console.error('❌ Error reading music database:', error.message);
    return false;
  }
}

if (require.main === module) {
  console.log('🎯 Checking if music database exists...');
  
  if (checkForNewMusic()) {
    runWorkflow().catch(console.error);
  } else {
    console.log('💡 To use this workflow:');
    console.log('   1. Add new music to your database first');
    console.log('   2. Then run: node scripts/update-music-workflow.js');
    console.log('   3. Or use: npm run update-music (if you add this to package.json)');
  }
}

module.exports = { runWorkflow };