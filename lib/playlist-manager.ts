import { promises as fs } from 'fs';
import path from 'path';

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  episodeTitle: string;
  episodeDate: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  source: string;
  feedUrl: string;
  image?: string;
  feedGuid?: string;
  itemGuid?: string;
  order?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  tracks: PlaylistTrack[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    totalDuration: number;
    trackCount: number;
    feedUrl: string;
    lastSync?: string;
    version: string;
  };
  settings?: {
    autoUpdate: boolean;
    shuffle: boolean;
    repeat: 'none' | 'all' | 'one';
  };
}

export interface PlaylistExport {
  version: '1.0';
  type: 'music-playlist';
  format: 'podcasting20';
  playlist: {
    title: string;
    description: string;
    image?: string;
    tracks: Array<{
      title: string;
      artist: string;
      audioUrl: string;
      duration: number;
      guid?: string;
      feedGuid?: string;
      itemGuid?: string;
      startTime?: number;
      endTime?: number;
    }>;
  };
}

export class PlaylistManager {
  private static playlistsPath = path.join(process.cwd(), 'data', 'playlists');
  private static playlistsFile = path.join(PlaylistManager.playlistsPath, 'playlists.json');

  static async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(PlaylistManager.playlistsPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create playlists directory:', error);
    }
  }

  static async getAllPlaylists(): Promise<Playlist[]> {
    await this.ensureDataDirectory();
    
    try {
      const data = await fs.readFile(this.playlistsFile, 'utf8');
      const playlists = JSON.parse(data);
      return playlists.playlists || [];
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      console.error('Failed to load playlists:', error);
      return [];
    }
  }

  static async getPlaylist(id: string): Promise<Playlist | null> {
    const playlists = await this.getAllPlaylists();
    return playlists.find(p => p.id === id) || null;
  }

  static async createPlaylist(
    name: string,
    description: string,
    feedUrl: string,
    tracks: PlaylistTrack[]
  ): Promise<Playlist> {
    await this.ensureDataDirectory();
    
    const playlist: Playlist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      tracks: tracks.map((track, index) => ({
        ...track,
        order: index
      })),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalDuration: tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
        trackCount: tracks.length,
        feedUrl,
        version: '1.0.0'
      },
      settings: {
        autoUpdate: true,
        shuffle: false,
        repeat: 'none'
      }
    };

    const playlists = await this.getAllPlaylists();
    playlists.push(playlist);
    
    await this.savePlaylists(playlists);
    
    return playlist;
  }

  static async updatePlaylist(id: string, updates: Partial<Playlist>): Promise<Playlist | null> {
    const playlists = await this.getAllPlaylists();
    const index = playlists.findIndex(p => p.id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedPlaylist = {
      ...playlists[index],
      ...updates,
      metadata: {
        ...playlists[index].metadata,
        updatedAt: new Date().toISOString(),
        trackCount: updates.tracks ? updates.tracks.length : playlists[index].metadata.trackCount,
        totalDuration: updates.tracks 
          ? updates.tracks.reduce((sum, track) => sum + (track.duration || 0), 0)
          : playlists[index].metadata.totalDuration
      }
    };

    playlists[index] = updatedPlaylist;
    await this.savePlaylists(playlists);
    
    return updatedPlaylist;
  }

  static async deletePlaylist(id: string): Promise<boolean> {
    const playlists = await this.getAllPlaylists();
    const filtered = playlists.filter(p => p.id !== id);
    
    if (filtered.length === playlists.length) {
      return false;
    }

    await this.savePlaylists(filtered);
    return true;
  }

  static async addTracksToPlaylist(playlistId: string, tracks: PlaylistTrack[]): Promise<Playlist | null> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return null;
    }

    const currentMaxOrder = Math.max(...playlist.tracks.map(t => t.order || 0), 0);
    const newTracks = tracks.map((track, index) => ({
      ...track,
      order: currentMaxOrder + index + 1
    }));

    playlist.tracks.push(...newTracks);
    
    return await this.updatePlaylist(playlistId, {
      tracks: playlist.tracks
    });
  }

  static async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<Playlist | null> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return null;
    }

    playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
    
    // Reorder remaining tracks
    playlist.tracks = playlist.tracks.map((track, index) => ({
      ...track,
      order: index
    }));

    return await this.updatePlaylist(playlistId, {
      tracks: playlist.tracks
    });
  }

  static async reorderTracks(playlistId: string, trackIds: string[]): Promise<Playlist | null> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return null;
    }

    const trackMap = new Map(playlist.tracks.map(t => [t.id, t]));
    const reorderedTracks = trackIds
      .map(id => trackMap.get(id))
      .filter(Boolean)
      .map((track, index) => ({
        ...track!,
        order: index
      }));

    return await this.updatePlaylist(playlistId, {
      tracks: reorderedTracks
    });
  }

  static async syncPlaylistFromFeed(playlistId: string, feedUrl: string): Promise<Playlist | null> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return null;
    }

    try {
      // Fetch latest tracks from the feed
      const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(feedUrl)}`);
      const data = await response.json();
      
      if (data.success && data.data.tracks) {
        const newTracks = data.data.tracks;
        
        // Merge with existing tracks, avoiding duplicates
        const existingIds = new Set(playlist.tracks.map(t => t.id));
        const tracksToAdd = newTracks.filter((track: PlaylistTrack) => !existingIds.has(track.id));
        
        if (tracksToAdd.length > 0) {
          playlist.tracks.push(...tracksToAdd);
          playlist.metadata.lastSync = new Date().toISOString();
          
          return await this.updatePlaylist(playlistId, playlist);
        }
      }
    } catch (error) {
      console.error('Failed to sync playlist:', error);
    }

    return playlist;
  }

  static async exportToPodcasting20(playlistId: string): Promise<PlaylistExport | null> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      return null;
    }

    return {
      version: '1.0',
      type: 'music-playlist',
      format: 'podcasting20',
      playlist: {
        title: playlist.name,
        description: playlist.description,
        image: playlist.coverImage,
        tracks: playlist.tracks.map(track => ({
          title: track.title,
          artist: track.artist,
          audioUrl: track.audioUrl,
          duration: track.duration,
          guid: track.id,
          feedGuid: track.feedGuid,
          itemGuid: track.itemGuid,
          startTime: track.startTime,
          endTime: track.endTime
        }))
      }
    };
  }

  static async importFromTracks(
    tracks: PlaylistTrack[],
    name: string,
    description: string,
    feedUrl: string
  ): Promise<Playlist> {
    return await this.createPlaylist(name, description, feedUrl, tracks);
  }

  private static async savePlaylists(playlists: Playlist[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const data = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      playlists
    };
    
    await fs.writeFile(this.playlistsFile, JSON.stringify(data, null, 2));
  }

  static async createOrUpdateMainPlaylist(feedUrl: string): Promise<Playlist> {
    const MAIN_PLAYLIST_NAME = 'Into The Doerfel-Verse Music';
    
    // Check if main playlist exists
    const playlists = await this.getAllPlaylists();
    let mainPlaylist = playlists.find(p => p.name === MAIN_PLAYLIST_NAME);
    
    // Fetch tracks from feed or database
    const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(feedUrl)}`);
    const data = await response.json();
    
    if (!data.success || !data.data.tracks) {
      throw new Error('Failed to fetch tracks');
    }
    
    const tracks = data.data.tracks;
    
    if (mainPlaylist) {
      // Update existing playlist
      return await this.updatePlaylist(mainPlaylist.id, {
        tracks,
        metadata: {
          ...mainPlaylist.metadata,
          updatedAt: new Date().toISOString(),
          lastSync: new Date().toISOString(),
          trackCount: tracks.length,
          totalDuration: tracks.reduce((sum: number, track: any) => sum + (track.duration || 0), 0)
        }
      }) as Playlist;
    } else {
      // Create new playlist
      return await this.createPlaylist(
        MAIN_PLAYLIST_NAME,
        'Complete music collection from Into The Doerfel-Verse podcast episodes',
        feedUrl,
        tracks
      );
    }
  }
}