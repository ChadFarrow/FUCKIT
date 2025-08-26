#!/usr/bin/env node

// Map of track titles to their audio file names on doerfelverse.com
const AUDIO_URL_MAP = {
  "Neon Hawk": "neon-hawk.mp3",
  "Grey's Birthday": "greys-birthday.mp3",
  "Smokestacks": "smokestacks.mp3",
  "Lost in Motion": "lost-in-motion.mp3",
  "The HeyCitizen Experience - Love Song 4 U": "love-song-4-u.mp3",
  "The Lightning": "the-lightning.mp3",
  "Trailer": "trailer.mp3",
  "Animosity": "animosity.mp3",
  "West Coast Drive": "west-coast-drive.mp3",
  "Chasing Waterfalls": "chasing-waterfalls.mp3",
  "Call Me Medley": "call-me-medley.mp3",
  "Empath Eyes - Apathy": "empath-eyes-apathy.mp3",
  "Bullet Train": "bullet-train.mp3",
  "Mrs Valentine": "mrs-valentine.mp3",
  "Once Had A Girl": "once-had-a-girl.mp3",
  "Porkchops Fried": "porkchops-fried.mp3",
  "Not To Worry": "not-to-worry.mp3",
  "The Platform (lofi beats mix)": "platform-lofi.mp3",
  "The Platform": "the-platform.mp3",
  "I Want Love": "i-want-love.mp3",
  "Ring That Bell": "ring-that-bell.mp3",
  "Pour Me Some Water": "pour-me-some-water.mp3",
  "Give it Up": "give-it-up.mp3",
  "Long As You're Loving Me": "long-as-youre-loving-me.mp3",
  "I Believe": "i-believe.mp3",
  "Stay Awhile (reprise)": "stay-awhile-reprise.mp3",
  "Hard Work [Live in Amsterdam]": "hard-work-live.mp3",
  "This Pain I've Grown": "this-pain-ive-grown.mp3",
  "A Sight To See Remix": "sight-to-see-remix.mp3",
  "Honor You": "honor-you.mp3",
  "All Apology (EP track)": "all-apology.mp3",
  "St. Joan": "st-joan.mp3",
  "Bringing Em Down": "bringing-em-down.mp3",
  "Let Go (What's holding you back)": "let-go.mp3",
  "Calibrating Broadcast...": "calibrating-broadcast.mp3",
  "Radio Brigade": "radio-brigade.mp3",
  "Hello Stranger feat. Helen Tess": "hello-stranger.mp3",
  "A Chemical to Balance": "chemical-to-balance.mp3",
  "Emma Rose": "emma-rose.mp3",
  "They Don't Know": "they-dont-know.mp3",
  "Possible": "possible.mp3",
  "What Love Is": "what-love-is.mp3",
  "Bad People": "bad-people.mp3",
  "Hardware Store Lady": "hardware-store-lady.mp3",
  "That's How It Goes": "thats-how-it-goes.mp3",
  "Out of the Blue": "out-of-the-blue.mp3",
  "The Poet Barfly - Demo": "poet-barfly-demo.mp3",
  "Kerouac": "kerouac.mp3",
  "So Far Away": "so-far-away.mp3",
  "I Do It Cuz It's Bad": "i-do-it-cuz-its-bad.mp3",
  "Beer Run": "beer-run.mp3",
  "Girls at Kroger": "girls-at-kroger.mp3",
  "Midnight Comin'": "midnight-comin.mp3",
  "If I Promise(Demo)": "if-i-promise-demo.mp3",
  "Phatty The Grasshopper": "phatty-grasshopper.mp3",
  "Railroad Tracks": "railroad-tracks.mp3",
  "Wonder Woman": "wonder-woman.mp3",
  "Now I Know": "now-i-know.mp3",
  "What's Your New Love Like": "whats-your-new-love-like.mp3",
  "Pay The Bills": "pay-the-bills.mp3",
  "Feeling Bout You": "feeling-bout-you.mp3",
  "Playing God": "playing-god.mp3",
  "That's the Life": "thats-the-life.mp3",
  "Grow": "grow.mp3",
  "Let You Down": "let-you-down.mp3",
  "Happy New Year(demo)": "happy-new-year-demo.mp3",
  "That Duck": "that-duck.mp3",
  "Big Sciota": "big-sciota.mp3",
  "Sensitive Guy": "sensitive-guy.mp3",
  "Secrets": "secrets.mp3",
  "Worth Fighting For": "worth-fighting-for.mp3",
  "You": "you.mp3",
  "Safe": "safe.mp3",
  "Ordinary": "ordinary.mp3",
  "Maybe It's You": "maybe-its-you.mp3",
  "Make It": "make-it.mp3",
  "Sing For You": "sing-for-you.mp3",
  "Pour Over": "pour-over.mp3",
  "Worthy Lofi": "worthy-lofi.mp3",
  "Breakaway (demo)": "breakaway-demo.mp3",
  "Thought It Was Real": "thought-it-was-real.mp3",
  "Morning Love": "morning-love.mp3",
  "SWEATS": "sweats.mp3"
};

// Function to normalize title for matching
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

// Function to find best match for a title
function findAudioUrl(title) {
  // Try exact match first
  if (AUDIO_URL_MAP[title]) {
    return `https://www.doerfelverse.com/tracks/${AUDIO_URL_MAP[title]}`;
  }
  
  // Try normalized match
  const normalized = normalizeTitle(title);
  for (const [mapTitle, filename] of Object.entries(AUDIO_URL_MAP)) {
    if (normalizeTitle(mapTitle) === normalized) {
      return `https://www.doerfelverse.com/tracks/${filename}`;
    }
  }
  
  // Fallback - generate filename from title
  const filename = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() + '.mp3';
  
  console.log(`⚠️ No exact match for "${title}", using generated: ${filename}`);
  return `https://www.doerfelverse.com/tracks/${filename}`;
}

// Read the ITDVPlaylistAlbum.tsx file
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/ITDVPlaylistAlbum.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Extract RESOLVED_SONGS array
const startIndex = content.indexOf('const RESOLVED_SONGS = [');
const endIndex = content.indexOf('];', startIndex) + 2;
const songsArrayStr = content.substring(startIndex, endIndex);

// Parse the array (carefully since it's TypeScript)
let songs;
try {
  // Remove TypeScript type annotations and parse
  const cleanedStr = songsArrayStr
    .replace('const RESOLVED_SONGS = ', '')
    .replace(/,\s*\]/g, ']'); // Remove trailing comma
  
  // Use eval carefully (only on our own code)
  eval('songs = ' + cleanedStr);
} catch (error) {
  console.error('Error parsing songs array:', error);
  process.exit(1);
}

// Add audioUrl to each song
const updatedSongs = songs.map(song => {
  const audioUrl = findAudioUrl(song.title);
  return {
    ...song,
    audioUrl: audioUrl
  };
});

// Generate the updated TypeScript code
const updatedContent = content.substring(0, startIndex) + 
  'const RESOLVED_SONGS = ' + 
  JSON.stringify(updatedSongs, null, 2) + 
  content.substring(endIndex);

// Write back to file
fs.writeFileSync(filePath, updatedContent);

console.log(`✅ Added audio URLs to ${updatedSongs.length} tracks`);
console.log('📝 Updated ITDVPlaylistAlbum.tsx');