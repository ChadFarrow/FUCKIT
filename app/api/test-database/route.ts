import { NextResponse } from 'next/server';
import { musicTrackDB } from '@/lib/music-track-database';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    console.log('🔍 Testing database directly...');
    
    // Check working directory and file paths
    const cwd = process.cwd();
    const dbFilePath = path.join(cwd, 'data', 'music-tracks.json');
    const fileExists = fs.existsSync(dbFilePath);
    const fileSize = fileExists ? fs.statSync(dbFilePath).size : 0;
    
    console.log('📁 Path info:', { cwd, dbFilePath, fileExists, fileSize });
    
    // Try reading the file directly
    let directFileData = null;
    let directFileError = null;
    try {
      const fileContent = fs.readFileSync(dbFilePath, 'utf8');
      directFileData = JSON.parse(fileContent);
      console.log('📖 Direct file read successful:', {
        totalTracks: directFileData.musicTracks?.length || 0,
        hasMusicTracks: !!directFileData.musicTracks
      });
    } catch (error) {
      directFileError = (error as Error).message;
      console.error('❌ Direct file read failed:', directFileError);
    }
    
    // Load database directly
    const database = await musicTrackDB.loadDatabase();
    console.log(`📊 Database loaded: ${database.musicTracks.length} tracks`);
    
    // Count tracks by source
    const sourceCounts: Record<string, number> = {};
    database.musicTracks.forEach(track => {
      const source = track.source || 'unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    // Test search
    const searchResult = await musicTrackDB.searchMusicTracks({ source: 'rss-playlist' }, 1, 5);
    console.log(`🔍 Search result: ${searchResult.tracks.length} tracks found`);
    
    return NextResponse.json({
      success: true,
      data: {
        pathInfo: { cwd, dbFilePath, fileExists, fileSize },
        directFileRead: {
          success: !directFileError,
          error: directFileError,
          totalTracks: directFileData?.musicTracks?.length || 0,
          hasMusicTracks: !!directFileData?.musicTracks
        },
        databaseService: {
          totalTracks: database.musicTracks.length,
          sourceCounts,
          searchResult: {
            total: searchResult.total,
            tracksFound: searchResult.tracks.length,
            firstTrack: searchResult.tracks[0] ? {
              id: searchResult.tracks[0].id,
              title: searchResult.tracks[0].title,
              source: searchResult.tracks[0].source
            } : null
          }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing database:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
} 