import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Publishers test API is working',
    timestamp: new Date().toISOString()
  });
} 