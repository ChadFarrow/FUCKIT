import { Metadata } from 'next';
import PublisherDetailClient from './PublisherDetailClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const publisherId = decodeURIComponent(id);
  
  return {
    title: `Publisher: ${publisherId} | DoerfelVerse`,
    description: `View all albums from publisher ${publisherId}`,
  };
}

export default async function PublisherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publisherId = decodeURIComponent(id);
  
  return <PublisherDetailClient publisherId={publisherId} />;
}