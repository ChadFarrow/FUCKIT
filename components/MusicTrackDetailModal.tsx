'use client';

import { useEffect } from 'react';
import { MusicTrack } from '@/lib/music-track-parser';
import MusicTrackDetail from './MusicTrackDetail';

interface MusicTrackDetailModalProps {
  track: MusicTrack | null;
  relatedTracks?: MusicTrack[];
  onPlay?: (track: MusicTrack) => void;
  onClose: () => void;
}

export default function MusicTrackDetailModal({ 
  track, 
  relatedTracks, 
  onPlay, 
  onClose 
}: MusicTrackDetailModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (track) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [track, onClose]);

  if (!track) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative h-full overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <MusicTrackDetail
              track={track}
              relatedTracks={relatedTracks}
              onPlay={onPlay}
              onClose={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
}