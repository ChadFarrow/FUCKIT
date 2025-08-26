#!/usr/bin/env node

/**
 * Clear Audio State Script
 * This script clears the audio state from localStorage to fix stuck play buttons
 */

console.log('🔧 Clearing audio state from localStorage...');

// Check if we're in a browser environment
if (typeof window !== 'undefined') {
  try {
    // Clear the audio state
    localStorage.removeItem('fuckit_audio_state');
    console.log('✅ Audio state cleared successfully');
    
    // Also clear any cached albums to force a fresh load
    localStorage.removeItem('cachedAlbums');
    localStorage.removeItem('albumsCacheTimestamp');
    console.log('✅ Album cache cleared');
    
    console.log('🔄 Please refresh the page to see the changes');
  } catch (error) {
    console.error('❌ Error clearing audio state:', error);
  }
} else {
  console.log('📝 To clear audio state in the browser:');
  console.log('1. Open browser developer tools (F12)');
  console.log('2. Go to Console tab');
  console.log('3. Run: localStorage.removeItem("fuckit_audio_state")');
  console.log('4. Refresh the page');
} 