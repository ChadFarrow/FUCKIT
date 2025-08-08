import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface PlaylistTrack {
  feedGuid: string;
  itemGuid: string;
  title: string;
  artist: string;
  audioUrl: string | null;
  artworkUrl: string | null;
  duration: number | null;
  feedTitle: string;
  feedUrl: string;
}

interface PlaylistRequest {
  playlistName: string;
  playlistDescription?: string;
  tracks: PlaylistTrack[];
  source?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { playlistName, playlistDescription, tracks, source = 'playlist' }: PlaylistRequest = await request.json();

    if (!playlistName || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: playlistName and tracks array' },
        { status: 400 }
      );
    }

    console.log(`🎵 Adding ${tracks.length} tracks from "${playlistName}" to database`);

    // Read the existing music database
    const dataPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    let musicData: { musicTracks: any[] };

    try {
      const existingData = await fs.readFile(dataPath, 'utf8');
      musicData = JSON.parse(existingData);
    } catch (error) {
      // Create new database structure if file doesn't exist
      console.log('📝 Creating new music-tracks.json database');
      musicData = { musicTracks: [] };
    }

    // Check for existing tracks to avoid duplicates
    const existingTrackIds = new Set(
      musicData.musicTracks.map((t: any) => `${t.episodeId}`)
    );

    const newTracks: any[] = [];
    const skippedTracks: any[] = [];

    tracks.forEach((track, index) => {
      const episodeId = `${track.feedGuid}-${track.itemGuid}`;
      
      if (existingTrackIds.has(episodeId)) {
        skippedTracks.push({
          title: track.title,
          artist: track.artist,
          reason: 'Already exists in database'
        });
        return;
      }

      // Create database track entry compatible with existing system
      const dbTrack = {
        id: `${playlistName.toLowerCase().replace(/\s+/g, '-')}-playlist-${Date.now()}-${index}`,
        title: track.title,
        artist: track.artist,
        episodeId: episodeId,
        episodeTitle: track.feedTitle || playlistName,
        episodeDate: new Date().toISOString(),
        startTime: 0,
        endTime: track.duration || 300,
        duration: track.duration || 300,
        audioUrl: track.audioUrl || '',
        image: track.artworkUrl || '',
        source: source,
        feedUrl: track.feedUrl,
        discoveredAt: new Date().toISOString(),
        playlist: {
          name: playlistName,
          description: playlistDescription || `Track from ${playlistName} playlist`
        },
        valueForValue: {
          lightningAddress: '',
          suggestedAmount: 0,
          remotePercentage: 90,
          feedGuid: track.feedGuid,
          itemGuid: track.itemGuid,
          resolved: !!track.audioUrl,
          resolvedTitle: track.title,
          resolvedArtist: track.artist,
          resolvedAudioUrl: track.audioUrl,
          resolvedImage: track.artworkUrl
        }
      };

      newTracks.push(dbTrack);
    });

    if (newTracks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new tracks to add - all tracks already exist in database',
        added: 0,
        skipped: skippedTracks.length,
        skippedTracks
      });
    }

    // Add new tracks to the database
    musicData.musicTracks.push(...newTracks);

    // Save back to database file
    await fs.writeFile(dataPath, JSON.stringify(musicData, null, 2));

    console.log(`✅ Added ${newTracks.length} new tracks to database, skipped ${skippedTracks.length} duplicates`);

    return NextResponse.json({
      success: true,
      message: `Successfully added ${newTracks.length} tracks from "${playlistName}" to database`,
      added: newTracks.length,
      skipped: skippedTracks.length,
      skippedTracks: skippedTracks.length > 0 ? skippedTracks : undefined,
      sampleTracks: newTracks.slice(0, 3).map(t => ({
        title: t.title,
        artist: t.artist,
        hasAudio: !!t.audioUrl,
        hasArtwork: !!t.image
      }))
    });

  } catch (error) {
    console.error('Error adding playlist to database:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add playlist to database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve playlist information
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const playlistName = url.searchParams.get('playlist');

    const dataPath = path.join(process.cwd(), 'data', 'music-tracks.json');
    const existingData = await fs.readFile(dataPath, 'utf8');
    const musicData = JSON.parse(existingData);

    if (playlistName) {
      // Return tracks for a specific playlist
      const playlistTracks = musicData.musicTracks.filter((track: any) => 
        track.playlist?.name?.toLowerCase() === playlistName.toLowerCase()
      );

      return NextResponse.json({
        playlistName,
        trackCount: playlistTracks.length,
        tracks: playlistTracks
      });
    } else {
      // Return all playlists
      const playlists = new Map();
      
      musicData.musicTracks.forEach((track: any) => {
        if (track.playlist?.name) {
          const name = track.playlist.name;
          if (!playlists.has(name)) {
            playlists.set(name, {
              name,
              description: track.playlist.description,
              trackCount: 0,
              hasAudio: 0,
              hasArtwork: 0
            });
          }
          const playlist = playlists.get(name);
          playlist.trackCount++;
          if (track.audioUrl) playlist.hasAudio++;
          if (track.image) playlist.hasArtwork++;
        }
      });

      return NextResponse.json({
        playlists: Array.from(playlists.values()),
        totalTracks: musicData.musicTracks.length
      });
    }

  } catch (error) {
    console.error('Error retrieving playlist data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve playlist data' },
      { status: 500 }
    );
  }
}