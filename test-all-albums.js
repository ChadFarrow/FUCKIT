const fs = require('fs');
const path = require('path');

// Test all albums for loading issues
function testAllAlbums() {
  const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
  
  if (!fs.existsSync(parsedFeedsPath)) {
    console.error('Parsed feeds data not found');
    return;
  }

  const fileContent = fs.readFileSync(parsedFeedsPath, 'utf-8');
  const parsedData = JSON.parse(fileContent);
  
  // Extract albums from parsed feeds
  const albums = parsedData.feeds
    .filter((feed) => feed.parseStatus === 'success' && feed.parsedData?.album)
    .map((feed) => feed.parsedData.album);

  console.log(`Testing ${albums.length} albums for loading issues...\n`);

  const results = {
    working: [],
    problematic: [],
    specialCases: []
  };

  // Test each album
  albums.forEach((album, index) => {
    const albumTitle = album.title;
    const expectedSlug = generateAlbumSlug(albumTitle);
    
    // Test if the album can be found using the generated slug
    const foundAlbum = findAlbumBySlug(albums, expectedSlug);
    
    if (foundAlbum && foundAlbum.title === albumTitle) {
      results.working.push({
        title: albumTitle,
        slug: expectedSlug,
        artist: album.artist,
        tracks: album.tracks.length
      });
    } else {
      // Check if it's a known special case
      const specialCases = {
        'bitpunk.fm': 'bitpunkfm',
        'into the doerfel-verse': 'into-the-doerfel-verse',
        'into the doerfel verse': 'into-the-doerfel-verse',
        'music from the doerfel-verse': 'music-from-the-doerfel-verse'
      };
      
      const lowerTitle = albumTitle.toLowerCase();
      if (specialCases[lowerTitle]) {
        results.specialCases.push({
          title: albumTitle,
          expectedSlug: expectedSlug,
          actualSlug: specialCases[lowerTitle],
          artist: album.artist,
          tracks: album.tracks.length
        });
      } else {
        results.problematic.push({
          title: albumTitle,
          slug: expectedSlug,
          artist: album.artist,
          tracks: album.tracks.length,
          foundAlbum: foundAlbum ? foundAlbum.title : 'NOT FOUND'
        });
      }
    }
  });

  // Report results
  console.log(`📊 Results Summary:`);
  console.log(`✅ Working albums: ${results.working.length}`);
  console.log(`⚠️  Special cases: ${results.specialCases.length}`);
  console.log(`❌ Problematic albums: ${results.problematic.length}\n`);

  if (results.specialCases.length > 0) {
    console.log(`⚠️  Special Cases (these are handled by special logic):`);
    results.specialCases.forEach(album => {
      console.log(`   - "${album.title}" (${album.artist})`);
      console.log(`     Expected: ${album.expectedSlug} → Actual: ${album.actualSlug}`);
    });
    console.log('');
  }

  if (results.problematic.length > 0) {
    console.log(`❌ Problematic Albums (need attention):`);
    results.problematic.forEach(album => {
      console.log(`   - "${album.title}" (${album.artist})`);
      console.log(`     Slug: ${album.slug}`);
      console.log(`     Found: ${album.foundAlbum}`);
      console.log(`     Tracks: ${album.tracks}`);
      console.log('');
    });
  } else {
    console.log(`🎉 All albums are working correctly!`);
  }

  // Test specific problematic patterns
  console.log(`\n🔍 Testing specific URL patterns...`);
  testSpecificPatterns(albums);
}

// Generate album slug (same logic as url-utils.ts)
function generateAlbumSlug(title) {
  const specialCases = {
    'bitpunk.fm': 'bitpunkfm',
    'into the doerfel-verse': 'into-the-doerfel-verse',
    'into the doerfel verse': 'into-the-doerfel-verse',
    'music from the doerfel-verse': 'music-from-the-doerfel-verse'
  };
  
  const lowerTitle = title.toLowerCase().trim();
  if (specialCases[lowerTitle]) {
    return specialCases[lowerTitle];
  }
  
  let slug = title
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/@/g, 'at')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (!slug) {
    slug = 'album-' + Date.now();
  }
  
  return slug;
}

// Find album by slug (same logic as AlbumDetailClient.tsx)
function findAlbumBySlug(albums, searchSlug) {
  const searchTitleLower = searchSlug.toLowerCase();
  
  return albums.find((album) => {
    const albumTitleLower = album.title.toLowerCase();
    
    // First try exact match (case-sensitive)
    if (album.title === searchSlug) {
      return true;
    }
    
    // Then try case-insensitive exact match
    if (albumTitleLower === searchTitleLower) {
      return true;
    }
    
    // Then try normalized exact match
    const normalizedAlbum = albumTitleLower.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const normalizedSearch = searchTitleLower.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    if (normalizedAlbum === normalizedSearch) {
      return true;
    }
    
    // For URL slugs, convert back to title format and try exact match
    const slugToTitle = (slug) => slug.replace(/-/g, ' ');
    const titleFromSlug = slugToTitle(searchTitleLower);
    if (albumTitleLower === titleFromSlug) {
      return true;
    }
    
    // Try reverse slug generation to match
    const generateSlug = (title) => title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const albumSlug = generateSlug(album.title);
    const searchSlugGenerated = generateSlug(searchTitleLower);
    if (albumSlug === searchSlugGenerated) {
      return true;
    }
    
    // Special cases for known problematic titles
    const specialCases = {
      'stay awhile': 'Stay Awhile',
      'all in a day': 'All in a Day',
      'bloodshot lies': 'Bloodshot Lies',
      'bloodshot lies album': 'Bloodshot Lies - The Album',
      'into the doerfel verse': 'Into The Doerfel-Verse',
      'into the doerfel-verse': 'Into The Doerfel-Verse',
      'into-the-doerfel-verse': 'Into The Doerfel-Verse',
      'into the doerfelverse': 'Into The Doerfel-Verse',
      'music from the doerfel verse': 'Music From The Doerfel-Verse',
      'music from the doerfel-verse': 'Music From The Doerfel-Verse',
      'music-from-the-doerfel-verse': 'Music From The Doerfel-Verse',
      'i guess this will have to do': 'I Guess This Will Have To Do',
      'i-guess-this-will-have-to-do': 'I Guess This Will Have To Do',
      'bitpunkfm': 'bitpunk.fm',
      'bitpunk-fm': 'bitpunk.fm',
      'bitpunk fm': 'bitpunk.fm'
    };
    
    if (specialCases[searchTitleLower] && album.title === specialCases[searchTitleLower]) {
      return true;
    }
    
    // Try hyphen-aware matching for titles with hyphens
    const albumTitleWithoutHyphens = albumTitleLower.replace(/-/g, ' ');
    const searchTitleWithoutHyphens = searchTitleLower.replace(/-/g, ' ');
    if (albumTitleWithoutHyphens === searchTitleWithoutHyphens) {
      return true;
    }
    
    return false;
  });
}

// Test specific problematic patterns
function testSpecificPatterns(albums) {
  const testCases = [
    'music-from-the-doerfel-verse',
    'into-the-doerfel-verse',
    'bitpunkfm',
    'stay-awhile',
    'bloodshot-lies',
    'i-guess-this-will-have-to-do'
  ];

  testCases.forEach(testSlug => {
    const found = findAlbumBySlug(albums, testSlug);
    if (found) {
      console.log(`✅ ${testSlug} → "${found.title}" (${found.artist})`);
    } else {
      console.log(`❌ ${testSlug} → NOT FOUND`);
    }
  });
}

testAllAlbums(); 