#!/usr/bin/env node

/**
 * Ensure Complete Publisher Feeds Script
 * 
 * This script ensures that all publisher feeds and their associated albums
 * are properly configured to prevent missing albums like the Ollie situation.
 * 
 * It should be run:
 * 1. After adding new feeds manually
 * 2. After parsing feeds to detect new publishers
 * 3. As a maintenance task to ensure completeness
 * 
 * Usage: node scripts/ensure-complete-publisher-feeds.js
 */

const { autoAddPublisherFeeds } = require('./auto-add-publisher-feeds.js');

async function ensureCompletePublisherFeeds() {
  console.log('🔍 Ensuring complete publisher feed configuration...\n');
  
  try {
    // Step 1: Run the enhanced auto-add publisher feeds script
    console.log('📊 Step 1: Running enhanced publisher feed detection...');
    const addedFeeds = await autoAddPublisherFeeds();
    
    if (addedFeeds === 0) {
      console.log('\n✅ All publisher feeds and albums are properly configured!');
      return { success: true, addedFeeds: 0 };
    }
    
    // Step 2: If new feeds were added, suggest next steps
    console.log(`\n🎉 Found and added ${addedFeeds} new feeds!`);
    console.log('\n📋 Recommended next steps:');
    console.log('   1. Run feed parsing to populate the new feeds:');
    console.log('      curl -X POST "http://localhost:3000/api/parse-feeds?action=parse"');
    console.log('   2. Or use the parse-and-add-publishers script:');
    console.log('      npm run parse-and-add-publishers');
    console.log('   3. Check that all albums are now visible on publisher pages');
    
    return { success: true, addedFeeds };
    
  } catch (error) {
    console.error('❌ Error ensuring complete publisher feeds:', error);
    return { success: false, error: error.message };
  }
}

async function main() {
  const result = await ensureCompletePublisherFeeds();
  
  if (result.success) {
    if (result.addedFeeds === 0) {
      console.log('\n🎉 No action needed - everything is up to date!');
      process.exit(0);
    } else {
      console.log(`\n🎉 Successfully added ${result.addedFeeds} feeds!`);
      console.log('\n💡 Remember to run feed parsing to populate the new feeds.');
      process.exit(0);
    }
  } else {
    console.error('\n❌ Failed to ensure complete publisher feeds');
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { ensureCompletePublisherFeeds };

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error);
} 