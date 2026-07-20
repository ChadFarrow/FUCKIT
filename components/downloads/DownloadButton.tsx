'use client';

import { useState } from 'react';
import { Download, Loader2, Check } from 'lucide-react';
import { toast } from '@/components/Toast';
import { useDownloadsSafe } from '@/contexts/DownloadsContext';
import type {
  DownloadableTrack,
  DownloadableAlbum,
} from '@/lib/downloads/download-manager';

/**
 * Save-for-offline control, decoupled from the favorite heart. Scoped to albums
 * and individual tracks (playlists / VTS aren't downloadable). Renders nothing
 * when there's no resolvable audio URL or no DownloadsProvider in the tree, so
 * it's safe to drop in anywhere. States: idle (download) → queued/downloading
 * (spinner, tap to cancel) → downloaded (check, tap to remove).
 */
export type DownloadTarget =
  | { type: 'track'; track: DownloadableTrack }
  | { type: 'album'; album: DownloadableAlbum };

interface DownloadButtonProps {
  downloadTarget: DownloadTarget;
  className?: string;
  size?: number;
}

export default function DownloadButton({
  downloadTarget,
  className = '',
  size = 24,
}: DownloadButtonProps) {
  const downloads = useDownloadsSafe();
  const [touchHandled, setTouchHandled] = useState(false);

  const hasDownloadableContent =
    downloadTarget.type === 'track'
      ? !!downloadTarget.track?.url
      : !!downloadTarget.album.tracks?.some((t) => !!t?.url);
  const downloadEnabled = hasDownloadableContent && !!downloads;

  if (!downloadEnabled) return null;

  const agg =
    downloadTarget.type === 'track'
      ? downloads!.getTrackState(downloadTarget.track)
      : downloads!.getAlbumState(downloadTarget.album);

  const isDownloaded = agg.status === 'downloaded';
  const isDownloading = agg.status === 'downloading' || agg.status === 'queued';

  const startDownload = () => {
    if (!downloads!.isOnline) {
      toast.error("You're offline — connect to download for offline listening.");
      return;
    }
    // Fire-and-forget: the button reflects progress via context re-renders.
    if (downloadTarget.type === 'track') downloads!.downloadTrack(downloadTarget.track);
    else downloads!.downloadAlbum(downloadTarget.album);
  };

  const removeDownload = async () => {
    if (downloadTarget.type === 'track') await downloads!.removeTrack(downloadTarget.track);
    else await downloads!.removeAlbum(downloadTarget.album);
  };

  // idle → start; downloading/queued → cancel; downloaded → remove.
  const activate = async () => {
    if (isDownloaded || isDownloading) await removeDownload();
    else startDownload();
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (touchHandled) {
      setTouchHandled(false);
      return;
    }
    await activate();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).dataset.touched = 'true';
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const button = e.currentTarget as HTMLElement;
    if (button.dataset.touched === 'true') {
      delete button.dataset.touched;
      setTouchHandled(true);
      await activate();
    }
  };

  const ariaLabel = isDownloaded
    ? 'Downloaded for offline — tap to remove'
    : isDownloading
      ? 'Downloading — tap to cancel'
      : 'Download for offline';

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`download-button ${className} transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation cursor-pointer`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {isDownloading ? (
        <Loader2 size={size} className="animate-spin text-amber-400 flex-shrink-0" />
      ) : isDownloaded ? (
        <Check size={size} className="text-green-500 flex-shrink-0" />
      ) : (
        <Download size={size} className="text-gray-400 hover:text-white flex-shrink-0" />
      )}
    </button>
  );
}
