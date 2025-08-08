import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Test API is working',
    timestamp: new Date().toISOString()
  });
} 