'use client';

import { useState } from 'react';
import { Download, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from '@/components/Toast';
import { useDownloadsSafe } from '@/contexts/DownloadsContext';
import { isDownloadable } from '@/lib/downloads/download-manager';
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
  /** Classes for the idle download arrow. The icon carries its own text colour,
      so a `text-*` on `className` can never reach it — pass it here. */
  iconClassName?: string;
  size?: number;
}

export default function DownloadButton({
  downloadTarget,
  className = '',
  iconClassName = 'text-gray-400 hover:text-white',
  size = 24,
}: DownloadButtonProps) {
  const downloads = useDownloadsSafe();
  const [touchHandled, setTouchHandled] = useState(false);

  // Must match what the manager will actually save, not merely "has a URL".
  // Gating on `!!url` alone rendered an arrow for video/HLS albums that
  // `downloadAlbum` then filtered to zero tracks — a button that did nothing,
  // forever, with no explanation.
  const hasDownloadableContent =
    downloadTarget.type === 'track'
      ? isDownloadable(downloadTarget.track ?? {})
      : !!downloadTarget.album.tracks?.some((t) => !!t && isDownloadable(t));
  const downloadEnabled = hasDownloadableContent && !!downloads;

  if (!downloadEnabled) return null;

  const agg =
    downloadTarget.type === 'track'
      ? downloads!.getTrackState(downloadTarget.track)
      : downloads!.getAlbumState(downloadTarget.album);

  const isDownloaded = agg.status === 'downloaded';
  const isDownloading = agg.status === 'downloading' || agg.status === 'queued';
  const isError = agg.status === 'error';

  const startDownload = async () => {
    if (!downloads!.isOnline) {
      toast.error("You're offline — connect to download for offline listening.");
      return;
    }
    // A failure used to be invisible here: 'error' fell through to the idle
    // arrow, so a download that never worked looked identical to one never
    // started, and the only report we got was "it won't download".
    if (downloadTarget.type === 'track') {
      const ok = await downloads!.downloadTrack(downloadTarget.track);
      if (!ok && downloads!.getTrackState(downloadTarget.track).status === 'error') {
        toast.error("Couldn't download this track — its host refused the request.");
      }
    } else {
      const result = await downloads!.downloadAlbum(downloadTarget.album);
      if (result.status === 'error') {
        toast.error(
          result.done > 0
            ? `Downloaded ${result.done} of ${result.total} tracks — the rest were refused by the host.`
            : "Couldn't download this album — its host refused the request."
        );
      }
    }
  };

  const removeDownload = async () => {
    if (downloadTarget.type === 'track') await downloads!.removeTrack(downloadTarget.track);
    else await downloads!.removeAlbum(downloadTarget.album);
  };

  // idle → start; downloading/queued → cancel; downloaded → remove; error → retry.
  const activate = async () => {
    if (isDownloaded || isDownloading) await removeDownload();
    else await startDownload();
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
      : isError
        ? 'Download failed — tap to retry'
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
      ) : isError ? (
        <AlertCircle size={size} className="text-red-400 flex-shrink-0" />
      ) : (
        <Download size={size} className={`${iconClassName} flex-shrink-0`} />
      )}
    </button>
  );
}
