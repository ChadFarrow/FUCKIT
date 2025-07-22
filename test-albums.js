const https = require('https');
const http = require('http');

// List of album titles to test
const albums = [
  'Into The Doerfel-Verse',
  'Music From The Doerfel-Verse', 
  'Bloodshot Lies',
  'Wrath of Banjo',
  'Ben Doerfel',
  '18 Sundays',
  'Alandace',
  'Autumn',
  'Christ Exalted',
  'Come Back To Me',
  'Dead Time Live 2016',
  'DFB V1',
  'DFB V2',
  'Disco Swag',
  'Doerfels Pubfeed',
  'First Married Christmas',
  'Generation Gap',
  'Heartbreak',
  'Merry Christmix',
  'Middle Season Let Go',
  'Phatty The Grasshopper',
  'Possible',
  'Pour Over',
  'Psalm 54',
  'Sensitive Guy',
  'They Dont Know',
  'Think EP',
  'Underwater Single',
  'Unsound Existence',
  'You Are My World',
  'You Feel Like Home',
  'Your Chance',
  'Nostalgic',
  'CityBeach',
  'Kurtisdrums V1',
  'Ring That Bell'
];

function testAlbum(albumTitle) {
  return new Promise((resolve) => {
    const encodedTitle = encodeURIComponent(albumTitle);
    const url = `http://localhost:3000/album/${encodedTitle}`;
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const hasError = data.includes('Album Not Found') || data.includes('404') || data.includes('This page could not be found');
        const isLoading = data.includes('Loading Album');
        const hasContent = data.includes('album') && !hasError && !isLoading;
        
        resolve({
          album: albumTitle,
          status: res.statusCode,
          hasError,
          isLoading,
          hasContent,
          url: `/album/${encodedTitle}`
        });
      });
    }).on('error', (err) => {
      resolve({
        album: albumTitle,
        status: 'ERROR',
        hasError: true,
        isLoading: false,
        hasContent: false,
        error: err.message,
        url: `/album/${encodedTitle}`
      });
    });
  });
}

async function testAllAlbums() {
  console.log('🎵 Testing all album pages...\n');
  
  const results = [];
  
  for (const album of albums) {
    const result = await testAlbum(album);
    results.push(result);
    
    const status = result.hasError ? '❌ ERROR' : 
                   result.isLoading ? '⏳ LOADING' : 
                   result.hasContent ? '✅ WORKING' : '❓ UNKNOWN';
    
    console.log(`${status} - ${album}`);
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('===========');
  
  const working = results.filter(r => r.hasContent);
  const loading = results.filter(r => r.isLoading);
  const errors = results.filter(r => r.hasError);
  
  console.log(`✅ Working: ${working.length}`);
  console.log(`⏳ Loading: ${loading.length}`);
  console.log(`❌ Errors: ${errors.length}`);
  
  if (working.length > 0) {
    console.log('\n✅ WORKING ALBUMS:');
    working.forEach(r => console.log(`  - ${r.album}`));
  }
  
  if (loading.length > 0) {
    console.log('\n⏳ LOADING ALBUMS:');
    loading.forEach(r => console.log(`  - ${r.album}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ ERROR ALBUMS:');
    errors.forEach(r => console.log(`  - ${r.album} (${r.status})`));
  }
}

testAllAlbums().catch(console.error); 