#!/usr/bin/env node

/**
 * Post-Parse Cleanup Script
 * 
 * This script runs after feed parsing to:
 * 1. Auto-add any discovered publisher feeds
 * 2. Clean up any parsing artifacts
 * 3. Generate a summary report
 * 
 * Usage: node scripts/post-parse-cleanup.js
 */

const { autoAddPublisherFeeds } = require('./auto-add-publisher-feeds.js');

async function main() {
  console.log('🧹 Running post-parse cleanup...\n');
  
  try {
    // Step 1: Auto-add publisher feeds
    console.log('📝 Step 1: Checking for new publisher feeds...');
    const newPublishers = await autoAddPublisherFeeds();
    
    // Step 2: Generate summary
    console.log('\n📊 Cleanup Summary:');
    console.log('==================');
    console.log(`✅ Publisher feeds processed`);
    console.log(`📝 New publishers added: ${newPublishers}`);
    
    if (newPublishers > 0) {
      console.log('\n💡 Next steps:');
      console.log('   - Run feed parsing again to include new publisher feeds');
      console.log('   - Check the app to verify new content is available');
    } else {
      console.log('\n🎉 All feeds are up to date!');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 