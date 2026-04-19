import { Metadata } from 'next';
import AlbumDetailClient from '@/app/album/[id]/AlbumDetailClient';
import AppLayout from '@/components/AppLayout';

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>,
  searchParams: Promise<{ track?: string }>
}): Promise<Metadata> {
  const { id } = await params;
  const { PODCAST_SLUG_TO_FEED_ID } = await import('@/lib/podcast-feeds');
  const feedId = PODCAST_SLUG_TO_FEED_ID[id] || id;

  let podcastTitle: string;
  try {
    podcastTitle = decodeURIComponent(id);
  } catch {
    podcastTitle = id;
  }
  podcastTitle = podcastTitle.replace(/-/g, ' ');

  let podcastImage: string | undefined;
  let podcastArtist: string | undefined;

  const baseUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : (process.env.NEXT_PUBLIC_BASE_URL || 'https://stablekraft.app');

  try {
    const response = await fetch(`${baseUrl}/api/albums/${encodeURIComponent(feedId)}`, {
      next: { revalidate: 3600 }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.album) {
        const coverArt = data.album.coverArt;
        if (coverArt && !coverArt.startsWith('http')) {
          podcastImage = `${baseUrl}${coverArt}`;
        } else {
          podcastImage = coverArt;
        }
        podcastArtist = data.album.artist;
        podcastTitle = data.album.title;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch podcast metadata:', error);
  }

  const description = podcastArtist
    ? `Listen to ${podcastTitle} by ${podcastArtist} on StableKraft`
    : `Listen to ${podcastTitle} on StableKraft`;

  return {
    title: `${podcastTitle} | StableKraft`,
    description,
    openGraph: {
      title: podcastTitle,
      description,
      images: podcastImage ? [{ url: podcastImage }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: podcastTitle,
      description,
      images: podcastImage ? [podcastImage] : [],
    },
  };
}

export default async function PodcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Redirect DB feed IDs to canonical slugs (e.g., silvie-two-for-tunestr -> two-for-tunestr)
  const { PODCAST_CANONICAL_SLUGS, PODCAST_SLUG_TO_FEED_ID } = await import('@/lib/podcast-feeds');
  if (PODCAST_CANONICAL_SLUGS[id]) {
    const { redirect } = await import('next/navigation');
    redirect(`/podcast/${PODCAST_CANONICAL_SLUGS[id]}`);
  }

  // Resolve slug to DB feed ID if different
  const feedId = PODCAST_SLUG_TO_FEED_ID[id] || id;

  let podcastTitle: string;
  try {
    podcastTitle = decodeURIComponent(id);
  } catch {
    podcastTitle = id;
  }
  podcastTitle = podcastTitle.replace(/-/g, ' ');

  return (
    <AppLayout>
      <AlbumDetailClient albumTitle={podcastTitle} albumId={feedId} initialAlbum={null} />
    </AppLayout>
  );
}
