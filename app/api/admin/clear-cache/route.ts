import { NextResponse } from 'next/server';
import dataService from '@/lib/data-service';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    
    const clearedCaches: string[] = [];
    
    // Clear data service cache
    if (type === 'all' || type === 'data') {
      dataService.clearCache();
      clearedCaches.push('data-service');
    }
    
    // Instructions for client-side cache clearing
    const clientInstructions = [];
    
    if (type === 'all' || type === 'browser') {
      clientInstructions.push('Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)');
      clientInstructions.push('Clear browser cache in DevTools > Application > Storage');
    }
    
    if (type === 'all' || type === 'service-worker') {
      clientInstructions.push('Unregister service worker in DevTools > Application > Service Workers');
      clientInstructions.push('Clear application data in DevTools > Application > Storage');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      clearedCaches,
      clientInstructions,
      message: `Cache clearing initiated. ${clearedCaches.length} server caches cleared.`
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: `Cache clearing failed: ${(error as Error).message}`
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

export async function GET() {
  return NextResponse.json({
    availableTypes: ['all', 'data', 'browser', 'service-worker'],
    usage: 'POST /api/admin/clear-cache?type=all',
    description: 'Clear various types of caches to resolve data consistency issues'
  });
}