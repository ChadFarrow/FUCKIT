import { Metadata } from 'next';
import { RSSParser, RSSAlbum } from '@/lib/rss-parser';
import AlbumDetailClient from './AlbumDetailClient';

// Dynamic generation - disable static generation for now
// export async function generateStaticParams() {
//   // Disabled due to build-time RSS fetching issues
//   return [];
// }

// Generate metadata for each album
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const albumTitle = decodeURIComponent(id);
  
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

// Server-side data fetching - simplified for dynamic generation
async function getAlbumData(albumTitle: string): Promise<RSSAlbum | null> {
  // For now, return null to let client-side handle data fetching
  // This prevents build-time RSS fetching issues
  return null;
}

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const albumTitle = decodeURIComponent(id);
  const album = await getAlbumData(albumTitle);
  
  return <AlbumDetailClient albumTitle={albumTitle} initialAlbum={album} />;
}