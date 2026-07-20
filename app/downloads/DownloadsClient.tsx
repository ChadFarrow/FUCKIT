'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Trash2, Play, WifiOff, HardDrive } from 'lucide-react';
import { useDownloads } from '@/contexts/DownloadsContext';
import { useAudio } from '@/contexts/AudioContext';
import type { DownloadRecord } from '@/lib/downloads/downloads-db';
import type { RSSAlbum } from '@/lib/rss-parser';
import { toast } from '@/components/Toast';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

interface DownloadGroup {
  id: string;
  kind: 'album' | 'playlist' | 'loose';
  title: string;
  coverArt?: string;
  records: DownloadRecord[];
}

/** Build a minimal playable album from a group so in-group next/prev works. */
function groupToAlbum(group: DownloadGroup): RSSAlbum {
  return {
    title: group.title,
    artist: group.records[0]?.artist || 'Unknown Artist',
    description: '',
    coverArt: group.coverArt || null,
    releaseDate: new Date(0).toISOString(),
    tracks: group.records.map((r) => ({
      title: r.title,
      url: r.key,
      artist: r.artist,
      guid: r.trackGuid,
      duration: r.durationSecs != null ? String(r.durationSecs) : '0',
    })),
  } as unknown as RSSAlbum;
}

export default function DownloadsClient() {
  const {
    ready,
    isOnline,
    listDownloads,
    removeByKey,
    clearAllDownloads,
    getStorageEstimate,
  } = useDownloads();
  const { playAlbum } = useAudio();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);

  const records = listDownloads();

  useEffect(() => {
    getStorageEstimate().then(setEstimate);
  }, [getStorageEstimate, records.length]);

  const groups = useMemo<DownloadGroup[]>(() => {
    const byAlbum = new Map<string, DownloadGroup>();
    const byPlaylist = new Map<string, DownloadGroup>();
    const loose: DownloadRecord[] = [];

    for (const rec of records) {
      if (rec.albumId) {
        const g = byAlbum.get(rec.albumId) ?? {
          id: rec.albumId,
          kind: 'album' as const,
          title: rec.albumTitle || 'Album',
          coverArt: rec.coverArt,
          records: [],
        };
        g.records.push(rec);
        byAlbum.set(rec.albumId, g);
      } else if (rec.playlistId) {
        const g = byPlaylist.get(rec.playlistId) ?? {
          id: rec.playlistId,
          kind: 'playlist' as const,
          title: rec.albumTitle || 'Playlist',
          coverArt: rec.coverArt,
          records: [],
        };
        g.records.push(rec);
        byPlaylist.set(rec.playlistId, g);
      } else {
        loose.push(rec);
      }
    }

    const out: DownloadGroup[] = [...byAlbum.values(), ...byPlaylist.values()];
    if (loose.length) {
      out.push({ id: 'loose', kind: 'loose', title: 'Individual tracks', records: loose });
    }
    return out;
  }, [records]);

  const totalBytes = records.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);

  const playGroupAt = (group: DownloadGroup, index: number) => {
    playAlbum(groupToAlbum(group), index).catch(() => {
      toast.error('Could not start playback.');
    });
  };

  const handleClearAll = async () => {
    if (!records.length) return;
    if (!window.confirm(`Remove all ${records.length} downloaded track(s)? This frees the storage they use.`)) {
      return;
    }
    await clearAllDownloads();
    toast.success('All downloads removed.');
  };

  if (!ready) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <p className="text-gray-400">Loading downloads…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-white">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Download className="h-7 w-7 text-amber-400" />
          Downloads
        </h1>
        {records.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4" /> Clear all
          </button>
        )}
      </div>

      {/* Storage usage */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <HardDrive className="h-4 w-4" />
        <span>
          {formatBytes(totalBytes)} downloaded
          {estimate?.quota ? ` · ${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)} used on device` : ''}
        </span>
      </div>

      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6 flex items-center gap-2 text-sm text-amber-200">
          <WifiOff className="h-4 w-4" /> You&apos;re offline — only downloaded tracks below will play.
        </div>
      )}

      {records.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Download className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="mb-2">No downloads yet.</p>
          <p className="text-sm">
            Tap the ❤️ on an album or track twice — once to favorite (red), again to download for offline
            (gold).
          </p>
          <Link href="/" className="inline-block mt-6 text-amber-400 hover:text-amber-300">
            Browse music →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={`${group.kind}-${group.id}`}>
              <div className="flex items-center gap-3 mb-3">
                {group.coverArt && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.coverArt}
                    alt=""
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                )}
                <div>
                  <h2 className="font-semibold">{group.title}</h2>
                  <p className="text-xs text-gray-400">
                    {group.records.length} track{group.records.length === 1 ? '' : 's'} ·{' '}
                    {formatBytes(group.records.reduce((s, r) => s + (r.sizeBytes || 0), 0))}
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-white/5 rounded-lg bg-black/20">
                {group.records.map((rec, i) => (
                  <li key={rec.key} className="flex items-center gap-3 px-3 py-2">
                    <button
                      onClick={() => playGroupAt(group, i)}
                      className="p-2 rounded-full hover:bg-white/10 flex-shrink-0"
                      aria-label={`Play ${rec.title}`}
                    >
                      <Play className="h-4 w-4" fill="currentColor" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{rec.title}</p>
                      {rec.artist && <p className="truncate text-xs text-gray-400">{rec.artist}</p>}
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatBytes(rec.sizeBytes || 0)}
                    </span>
                    <button
                      onClick={() => removeByKey(rec.key)}
                      className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-red-400 flex-shrink-0"
                      aria-label={`Remove download of ${rec.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-10">
        Downloads are stored on this device by your browser. On iOS, the browser may remove them to free
        space; if a download disappears it will simply stream again when you&apos;re online.
      </p>
    </div>
  );
}
