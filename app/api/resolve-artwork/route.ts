import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';
import { resolveArtworkFromPodcastIndex } from '@/lib/podcast-index-api';

export async function GET(request: NextRequest) {
  console.log('🚀 Starting resolve-artwork API call');
  
  try {
    const { searchParams } = new URL(request.url);
    const feedGuid = searchParams.get('feedGuid');
    const itemGuid = searchParams.get('itemGuid');
    
    console.log(`📥 Parameters: feedGuid=${feedGuid}, itemGuid=${itemGuid}`);
    
    if (!feedGuid) {
      console.log('❌ Missing feedGuid parameter');
      return NextResponse.json({ 
        success: false, 
        error: 'feedGuid parameter is required' 
      }, { status: 400 });
    }

    console.log(`🔍 Starting artwork resolution for feedGuid: ${feedGuid}, itemGuid: ${itemGuid}`);
    
    const artwork = await resolveArtworkFromPodcastIndex(feedGuid, itemGuid || undefined);
    
    console.log(`🎨 Artwork resolution completed: ${artwork ? 'SUCCESS' : 'NO ARTWORK FOUND'}`);
    
    if (artwork) {
      console.log(`✅ Successfully resolved artwork: ${artwork}`);
      return NextResponse.json({
        success: true,
        artwork,
        feedGuid,
        itemGuid
      });
    } else {
      console.log(`❌ No artwork found for feedGuid: ${feedGuid}, itemGuid: ${itemGuid}`);
      return NextResponse.json({
        success: false,
        error: 'No artwork found',
        feedGuid,
        itemGuid
      }, { status: 404 });
    }

  } catch (error) {
    console.error('Artwork resolution error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  const cors = await corsHeaders();
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...cors,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}