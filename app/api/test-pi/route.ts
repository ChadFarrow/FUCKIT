import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🧪 Test PI API endpoint called');
  
  try {
    // Just return environment check without making external calls
    const hasApiKey = !!process.env.PODCAST_INDEX_API_KEY;
    const hasApiSecret = !!process.env.PODCAST_INDEX_API_SECRET;
    
    console.log('🔑 Environment check - API Key:', hasApiKey, 'Secret:', hasApiSecret);
    
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working',
      hasApiKey,
      hasApiSecret,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}