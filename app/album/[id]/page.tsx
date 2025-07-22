import { Metadata } from 'next';
import { RSSParser, RSSAlbum } from '@/lib/rss-parser';
import AlbumDetailClient from './AlbumDetailClient';

// Static generation - pre-generate paths for known albums
export async function generateStaticParams() {
  try {
    console.log('🔄 Generating static params for album pages...');
    
    // Define known album feeds for static generation
    const knownFeeds = [
      'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
      'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
      'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
      'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
      'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
      'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
      'https://www.thisisjdog.com/media/ring-that-bell.xml',
    ];

    // Map feeds to proxy URLs
    const proxiedFeedUrls = knownFeeds.map(url => `/api/fetch-rss?url=${encodeURIComponent(url)}`);
    
    // Parse feeds to get album titles
    const albums = await RSSParser.parseMultipleFeeds(proxiedFeedUrls);
    
    // Generate static params for each album
    const params = albums.map(album => ({
      id: encodeURIComponent(album.title),
    }));

    console.log(`✅ Generated ${params.length} static paths for albums`);
    return params;
  } catch (error) {
    console.error('❌ Error generating static params:', error);
    // Return empty array if generation fails
    return [];
  }
}

// Generate metadata for each album
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const albumTitle = decodeURIComponent(params.id);
  
  try {
    // Try to fetch album data for metadata
    const album = await getAlbumData(albumTitle);
    
    if (album) {
      return {
        title: `${album.title} - ${album.artist} | DoerfelVerse`,
        description: album.description || `Listen to ${album.title} by ${album.artist}`,
        openGraph: {
          title: album.title,
          description: album.description || `Listen to ${album.title} by ${album.artist}`,
          images: album.coverArt ? [album.coverArt] : [],
        },
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  // Fallback metadata
  return {
    title: `${albumTitle} | DoerfelVerse`,
    description: `Listen to ${albumTitle} on DoerfelVerse`,
  };
}

// Server-side data fetching
async function getAlbumData(albumTitle: string): Promise<RSSAlbum | null> {
  try {
    // Smart feed selection based on album title
    let feedUrls: string[] = [];
    
    // Map album titles to their specific feeds
    const titleToFeedMap: { [key: string]: string } = {
      'into the doerfel-verse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
      'into the doerfelverse': 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
      'music from the doerfel-verse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
      'music from the doerfelverse': 'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
      'bloodshot lies': 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
      'wrath of banjo': 'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
      'ben doerfel': 'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
      'nostalgic': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml',
      'citybeach': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml',
      'kurtisdrums v1': 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml',
      'ring that bell': 'https://www.thisisjdog.com/media/ring-that-bell.xml',
    };
    
    // Try to find a specific feed first
    const normalizedTitle = albumTitle.toLowerCase();
    const specificFeed = titleToFeedMap[normalizedTitle];
    
    if (specificFeed) {
      feedUrls = [specificFeed];
    } else {
      // Fallback to main feeds
      feedUrls = [
        'https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml',
        'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml',
        'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',
        'https://www.doerfelverse.com/feeds/wrath-of-banjo.xml',
        'https://www.doerfelverse.com/feeds/ben-doerfel.xml',
      ];
    }
    
    // Map to proxy URLs
    const proxiedFeedUrls = feedUrls.map(url => `/api/fetch-rss?url=${encodeURIComponent(url)}`);
    
    // Parse feeds
    const albums = await RSSParser.parseMultipleFeeds(proxiedFeedUrls);
    
    // Find the matching album
    const album = albums.find(a => 
      a.title.toLowerCase() === albumTitle.toLowerCase() ||
      a.title.toLowerCase().includes(albumTitle.toLowerCase()) ||
      albumTitle.toLowerCase().includes(a.title.toLowerCase())
    );
    
    return album || null;
  } catch (error) {
    console.error('Error fetching album data:', error);
    return null;
  }
}

export default async function AlbumDetailPage({ params }: { params: { id: string } }) {
  const albumTitle = decodeURIComponent(params.id);
  const album = await getAlbumData(albumTitle);
  
  return <AlbumDetailClient albumTitle={albumTitle} initialAlbum={album} />;
}