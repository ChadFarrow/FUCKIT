import { NextResponse } from 'next/server';

export async function GET() {
  const podcastIndexKey = process.env.PODCAST_INDEX_API_KEY;
  const podcastIndexSecret = process.env.PODCAST_INDEX_API_SECRET;
  
  return NextResponse.json({
    hasKey: !!podcastIndexKey,
    hasSecret: !!podcastIndexSecret,
    keyLength: podcastIndexKey?.length || 0,
    secretLength: podcastIndexSecret?.length || 0,
    keyPrefix: podcastIndexKey?.substring(0, 4) || 'none',
    secretPrefix: podcastIndexSecret?.substring(0, 4) || 'none'
  });
} 