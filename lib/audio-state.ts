export interface GlobalAudioState {
  isPlaying: boolean;
  currentAlbum: string | null;
  currentTrackIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  trackUrl: string | null;
}

const STORAGE_KEY = 'fuckit_audio_state';

export const getGlobalAudioState = (): GlobalAudioState => {
  if (typeof window === 'undefined') {
    return {
      isPlaying: false,
      currentAlbum: null,
      currentTrackIndex: 0,
      currentTime: 0,
      duration: 0,
      volume: 1,
      trackUrl: null,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading audio state from localStorage:', error);
  }

  return {
    isPlaying: false,
    currentAlbum: null,
    currentTrackIndex: 0,
    currentTime: 0,
    duration: 0,
    volume: 1,
    trackUrl: null,
  };
};

export const setGlobalAudioState = (state: Partial<GlobalAudioState>) => {
  if (typeof window === 'undefined') return;

  try {
    const currentState = getGlobalAudioState();
    const newState = { ...currentState, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  } catch (error) {
    console.error('Error saving audio state to localStorage:', error);
  }
};

export const clearGlobalAudioState = () => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing audio state from localStorage:', error);
  }
};

export const updateGlobalAudioState = (
  updates: Partial<GlobalAudioState>,
  audioElement?: HTMLAudioElement
) => {
  if (audioElement) {
    // Update with current audio element state
    const state: Partial<GlobalAudioState> = {
      ...updates,
      currentTime: audioElement.currentTime,
      duration: audioElement.duration,
      volume: audioElement.volume,
    };
    setGlobalAudioState(state);
  } else {
    setGlobalAudioState(updates);
  }
};

// Mobile audio session management
export const setupMobileAudioSession = (audioElement?: HTMLAudioElement) => {
  if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      if (audioElement) audioElement.play();
    });
    
    navigator.mediaSession.setActionHandler('pause', () => {
      if (audioElement) audioElement.pause();
    });
    
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      // Implement previous track
    });
    
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      // Implement next track
    });
    
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (audioElement && details.seekTime) {
        audioElement.currentTime = details.seekTime;
      }
    });
  }
};

// Update metadata for lock screen controls
export const updateMediaSessionMetadata = (album: any, trackIndex: number) => {
  if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
    const track = album.tracks[trackIndex];
    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: album.artist || album.title,
        album: album.title,
        artwork: album.coverArt ? [
          { src: album.coverArt, sizes: '512x512', type: 'image/jpeg' },
          { src: album.coverArt, sizes: '256x256', type: 'image/jpeg' },
          { src: album.coverArt, sizes: '128x128', type: 'image/jpeg' },
        ] : []
      });
    }
  }
}; 