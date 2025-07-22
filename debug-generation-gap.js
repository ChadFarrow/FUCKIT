const testUrl = "Generation%20Gap";
const decoded = decodeURIComponent(testUrl);
console.log("Original URL:", testUrl);
console.log("Decoded URL:", decoded);
console.log("Normalized:", decoded.toLowerCase());

// Test the album lookup from the AlbumDetailClient
const titleToFeedMap = {
  'into the doerfel-verse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
  'into the doerfelverse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
  'music from the doerfel-verse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
  'music from the doerfelverse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
  'bloodshot lies': 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
  'bloodshot lies album': 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
  'wrath of banjo': 'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
  'beware of banjo': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/07/Beware-of-Banjo.xml',
  'ben doerfel': 'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
  'generation gap': 'https://www.doerfelverse.com/feeds/generation-gap.xml'
};

const normalizedTitle = decoded.toLowerCase();
const specificFeed = titleToFeedMap[normalizedTitle];
console.log("Specific feed found:", specificFeed);