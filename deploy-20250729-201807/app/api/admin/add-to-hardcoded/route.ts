import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { originalUrl, cdnUrl, type } = await request.json();

    if (!originalUrl || !type) {
      return NextResponse.json(
        { success: false, error: 'URL and type are required' },
        { status: 400 }
      );
    }

    const mainPagePath = path.join(process.cwd(), 'app', 'page.tsx');
    let content = await fs.readFile(mainPagePath, 'utf-8');
    
    // Find the end of the feedUrlMappings array
    const feedMappingsMatch = content.match(/const feedUrlMappings = \[([\s\S]*?)\];/);
    if (!feedMappingsMatch) {
      return NextResponse.json(
        { success: false, error: 'Could not find feedUrlMappings in page.tsx' },
        { status: 500 }
      );
    }

    // Create the new feed entry
    const newFeedEntry = `  ['${originalUrl}', '${cdnUrl || originalUrl}', '${type}'],`;
    
    // Find the closing bracket of the array
    const arrayStart = content.indexOf('const feedUrlMappings = [') + 'const feedUrlMappings = ['.length;
    const arrayEnd = content.indexOf('];', arrayStart);
    
    // Insert the new feed entry before the closing bracket
    const beforeArray = content.substring(0, arrayEnd);
    const afterArray = content.substring(arrayEnd);
    
    // Add a comment for the new feed
    const newContent = beforeArray + '\n  \n  // Added via admin dashboard\n' + newFeedEntry + '\n' + afterArray;
    
    // Write the updated content back to the file
    await fs.writeFile(mainPagePath, newContent, 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: 'Feed added to hardcoded list successfully'
    });

  } catch (error) {
    console.error('Error adding feed to hardcoded list:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add feed to hardcoded list',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}