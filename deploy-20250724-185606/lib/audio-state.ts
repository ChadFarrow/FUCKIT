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