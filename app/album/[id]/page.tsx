import { Metadata } from 'next';
import { RSSAlbum } from '@/lib/rss-parser';
import AlbumDetailClient from './AlbumDetailClient';
import { generateAlbumSlug } from '@/lib/url-utils';

// Dynamic generation - disable static generation for now
// export async function generateStaticParams() {
//   // Disabled due to build-time RSS fetching issues
//   return [];
// }

// Generate metadata for each album
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  
  // Handle both URL-encoded and slug formats
  let albumTitle: string;
  try {
    // First try to decode URL-encoded characters (e.g., %20 -> space)
    albumTitle = decodeURIComponent(id);
  } catch (error) {
    // If decoding fails, use the original id
    albumTitle = id;
  }
  
  // Convert hyphens to spaces for slug format (e.g., "stay-awhile" -> "stay awhile")
  albumTitle = albumTitle.replace(/-/g, ' ');
  
  try {
    // Try to fetch album data for metadata from pre-parsed API
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

// Server-side data fetching - use pre-parsed data API
async function getAlbumData(albumTitle: string): Promise<RSSAlbum | null> {
  try {
    // Fetch pre-parsed album data - use relative URL for production compatibility
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.NODE_ENV === 'production' ? 'https://re.podtards.com' : 'http://localhost:3000');
    const response = await fetch(`${baseUrl}/api/albums`, {
      // Add cache control to prevent stale data
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch albums for metadata:', response.status);
      return null;
    }
    
    const data = await response.json();
    const albums = data.albums || [];
    
    // Find the matching album
    const foundAlbum = albums.find((album: any) => {
      const albumTitleLower = album.title.toLowerCase();
      const searchTitleLower = albumTitle.toLowerCase();
      
      // Exact match
      if (album.title === albumTitle) return true;
      
      // Case-insensitive match
      if (albumTitleLower === searchTitleLower) return true;
      
      // Contains match
      if (albumTitleLower.includes(searchTitleLower) || searchTitleLower.includes(albumTitleLower)) return true;
      
      // Normalized match
      const normalizedAlbum = albumTitleLower.replace(/[^a-z0-9]/g, '');
      const normalizedSearch = searchTitleLower.replace(/[^a-z0-9]/g, '');
      if (normalizedAlbum === normalizedSearch) return true;
      
      return false;
    });
    
    return foundAlbum || null;
  } catch (error) {
    console.error('Error fetching album data for metadata:', error);
    return null;
  }
}

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Handle both URL-encoded and slug formats
  let albumTitle: string;
  try {
    // First try to decode URL-encoded characters (e.g., %20 -> space)
    albumTitle = decodeURIComponent(id);
  } catch (error) {
    // If decoding fails, use the original id
    albumTitle = id;
  }
  
  // Convert hyphens to spaces for slug format (e.g., "stay-awhile" -> "stay awhile")
  albumTitle = albumTitle.replace(/-/g, ' ');
  
  console.log(`🔍 Album page: id="${id}" -> albumTitle="${albumTitle}"`);
  
  const album = await getAlbumData(albumTitle);
  
  return <AlbumDetailClient albumTitle={albumTitle} initialAlbum={album} />;
}