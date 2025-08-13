#!/usr/bin/env node

// Simple slug generation test
function generateAlbumSlug(title) {
  // Special case handling for known problematic titles
  const specialCases = {
    'bitpunk.fm': 'bitpunkfm',
    'into the doerfel-verse': 'into-the-doerfel-verse',
    'into the doerfel verse': 'into-the-doerfel-verse',
    'music from the doerfel-verse': 'music-from-the-doerfel-verse',
    'bloodshot lies - the album': 'bloodshot-lies',
    'dead time(live 2016)': 'dead-timelive-2016',
    'let go (what\'s holding you back)': 'let-go-whats-holding-you-back',
    'they don\'t know': 'they-dont-know',
    'underwater - single': 'underwater-single',
    'unsound existence (self-hosted version)': 'unsound-existence-self-hosted-version',
    'you feel like home(single)': 'you-feel-like-homesingle',
    'the kid, the dad, the mom & the tiny window': 'the-kid-the-dad-the-mom-and-the-tiny-window',
    'don\'t worry, you still have time to ruin it - demo': 'dont-worry-you-still-have-time-to-ruin-it-demo',
    'fake love - demo': 'fake-love-demo',
    'roommates - demo': 'roommates-demo',
    'orange pill, pink pill, white pill - demo': 'orange-pill-pink-pill-white-pill-demo',
    'strangers to lovers - live from sloe flower studio': 'strangers-to-lovers-live-from-sloe-flower-studio',
    'can\'t promise you the world - live from sloe flower studio': 'cant-promise-you-the-world-live-from-sloe-flower-studio',
    'heycitizen\'s lo-fi hip-hop beats to study and relax to': 'heycitizens-lo-fi-hip-hop-beats-to-study-and-relax-to',
    'fountain artist takeover - nate johnivan': 'fountain-artist-takeover-nate-johnivan',
    'rock\'n\'roll breakheart': 'rocknroll-breakheart',
    'thankful (feat. witt lowry)': 'thankful-feat-witt-lowry',
    'bitpunk.fm unwound': 'bitpunkfm-unwound',
    'aged friends & old whiskey': 'aged-friends-and-old-whiskey'
  };
  
  const lowerTitle = title.toLowerCase().trim();
  if (specialCases[lowerTitle]) {
    return specialCases[lowerTitle];
  }
  
  // First, normalize the title
  let slug = title
    .toLowerCase()
    .trim()
    // Replace common special characters with their word equivalents
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/@/g, 'at')
    // Keep alphanumeric, spaces, and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with hyphens
    .replace(/\s/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '');
  
  // If the slug is empty after processing, use a fallback
  if (!slug) {
    slug = 'album-' + Date.now();
  }
  
  return slug;
}

// Test some album titles
const testTitles = [
  'Music From The Doerfel-Verse',
  'Bloodshot Lies - The Album',
  'Into The Doerfel-Verse',
  'Stay Awhile',
  '18 Sundays'
];

console.log('Testing album slug generation:');
testTitles.forEach(title => {
  const slug = generateAlbumSlug(title);
  console.log(`"${title}" -> "${slug}"`);
});
