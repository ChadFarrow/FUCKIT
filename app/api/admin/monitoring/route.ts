import { NextResponse } from 'next/server';
import monitoring from '@/lib/monitoring';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '100');
    const type = searchParams.get('type') || 'summary';

    let responseData;

    switch (type) {
      case 'summary':
        responseData = {
          summary: monitoring.getSummary(),
          recurringErrors: monitoring.getRecurringErrorPatterns()
        };
        break;
        
      case 'logs':
        responseData = {
          logs: category 
            ? monitoring.getLogsByCategory(category, limit)
            : monitoring.getRecentLogs(limit)
        };
        break;
        
      case 'errors':
        responseData = {
          recurringErrors: monitoring.getRecurringErrorPatterns(),
          recentErrors: monitoring.getRecentLogs(limit).filter(log => log.level === 'error')
        };
        break;
        
      default:
        responseData = {
          summary: monitoring.getSummary(),
          logs: monitoring.getRecentLogs(20),
          recurringErrors: monitoring.getRecurringErrorPatterns()
        };
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      type,
      ...responseData
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: `Monitoring endpoint failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

export async function DELETE() {
  try {
    monitoring.clearOldLogs();
    
    return NextResponse.json({
      success: true,
      message: 'Old logs cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Failed to clear logs: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
}