'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAudio } from '@/contexts/AudioContext';
import { SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, ChevronDown, Zap, Share2 } from 'lucide-react';
import { toast } from '@/components/Toast';
import { getAlbumArtworkUrl } from '@/lib/cdn-utils';
import { adjustColorBrightness, ensureGoodContrast } from '@/lib/color-utils';
import { colorCache } from '@/lib/color-cache';
import { BoostButton } from '@/components/Lightning/BoostButton';
import FavoriteButton from '@/components/favorites/FavoriteButton';
import DownloadButton from '@/components/downloads/DownloadButton';
import { useDownloadsSafe } from '@/contexts/DownloadsContext';
import { generateAlbumHref } from '@/lib/url-utils';
import { formatValueSplitsForBoost, getPrimaryRecipient } from '@/lib/v4v-utils';
import UserMenu from '@/components/UserMenu';
import { useUserSettings } from '@/hooks/useUserSettings';

interface NowPlayingScreenProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function NowPlayingScreen({ isOpen, onClose }: NowPlayingScreenProps = {}) {
  const router = useRouter();
  const {
    currentPlayingAlbum,
    isPlaying,
    currentTrackIndex,
    currentTime,
    duration,
    isShuffleMode,
    repeatMode,
    setRepeatMode,
    playNextTrack,
    playPreviousTrack,
    pause,
    resume,
    seek,
    toggleShuffle,
    isFullscreenMode,
    setFullscreenMode,
    isVideoMode,
    videoRef,
    chapters,
    currentChapterIndex,
  } = useAudio();

  const { settings, updateSettings } = useUserSettings();

  const downloads = useDownloadsSafe();
  const [downloadedCoverSrc, setDownloadedCoverSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [dominantColor, setDominantColor] = useState('#1A252F');
  const [contrastColors, setContrastColors] = useState({ backgroundColor: '#1A252F', textColor: '#ffffff' });
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [vtsV4vData, setVtsV4vData] = useState<{
    lightningAddress: string | null;
    valueSplits: Array<{ name: string; address: string; split: number; type: 'node' | 'lnaddress' }>;
    artistName?: string;
  } | null>(null);
  const [titleOverflows, setTitleOverflows] = useState(false);
  const [chapterTitleOverflows, setChapterTitleOverflows] = useState(false);

  const progressRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const chapterTitleRef = useRef<HTMLParagraphElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Find the active valueTimeSplit based on current playback position
  const activeVTS = useMemo(() => {
    const track = currentPlayingAlbum?.tracks?.[currentTrackIndex];
    const splits = track?.valueTimeSplits;
    if (!splits || !Array.isArray(splits) || splits.length === 0) return null;
    for (let i = splits.length - 1; i >= 0; i--) {
      const s = splits[i];
      if (currentTime >= s.startTime && currentTime < s.startTime + s.duration) {
        return s;
      }
    }
    return null;
  }, [currentPlayingAlbum, currentTrackIndex, currentTime]);

  // Reset VTS V4V data when track changes
  useEffect(() => {
    setVtsV4vData(null);
  }, [currentTrackIndex]);

  // Fetch remote track V4V data when a VTS segment with remoteItem is active
  useEffect(() => {
    if (!activeVTS?.remoteItem?.feedGuid || !activeVTS?.remoteItem?.itemGuid) {
      setVtsV4vData(null);
      return;
    }

    const controller = new AbortController();
    const { feedGuid, itemGuid } = activeVTS.remoteItem;
    const remotePercentage = activeVTS.remotePercentage ?? 100;

    const chapterTitle = chapters[currentChapterIndex]?.title || '';
    const params = new URLSearchParams({ feedGuid, itemGuid });
    if (chapterTitle) params.set('chapterTitle', chapterTitle);
    fetch(`/api/lightning/value-splits?${params}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.recipients?.length > 0) {
          const remoteRecipients = data.data.recipients.filter((r: any) => !r.fee);

          // Scale remote artist splits by remotePercentage
          const totalRemoteSplits = remoteRecipients.reduce((sum: number, r: any) => sum + (r.split || 100), 0);
          const scaledRemote = remoteRecipients.map((r: any) => ({
            name: r.name || 'Unknown',
            address: r.address,
            split: Math.round(((r.split || 100) / totalRemoteSplits) * remotePercentage),
            type: r.type || 'node' as 'node' | 'lnaddress',
            isHost: false
          }));

          // If remotePercentage < 100, blend in the podcast host's (feed-level) recipients
          let blended = scaledRemote;
          if (remotePercentage < 100) {
            const hostPercentage = 100 - remotePercentage;
            // Use album/feed-level V4V, not track-level (track V4V is the remote artist's)
            const hostSplits = formatValueSplitsForBoost(currentPlayingAlbum, currentPlayingAlbum?.artist)
              || [];
            const totalHostSplits = hostSplits.reduce((sum, r) => sum + r.split, 0);
            if (totalHostSplits > 0) {
              const scaledHost = hostSplits.map(r => ({
                ...r,
                split: Math.round((r.split / totalHostSplits) * hostPercentage),
                isHost: true
              }));
              blended = [...scaledRemote, ...scaledHost];
            }
          }

          // Deduplicate recipients with the same name (e.g., Podcastindex listed
          // with both lnaddress and node pubkey) — merge splits, prefer lnaddress
          const deduped: typeof blended = [];
          const seen = new Map<string, number>(); // lowercase name -> index in deduped
          for (const r of blended) {
            const key = (r.name || '').toLowerCase();
            const existing = seen.get(key);
            if (existing !== undefined) {
              deduped[existing].split += r.split;
              // Prefer lnaddress over node
              if (r.type === 'lnaddress' && deduped[existing].type !== 'lnaddress') {
                deduped[existing].address = r.address;
                deduped[existing].type = r.type;
              }
            } else {
              seen.set(key, deduped.length);
              deduped.push({ ...r });
            }
          }

          setVtsV4vData({
            lightningAddress: scaledRemote[0]?.address || null,
            valueSplits: deduped,
            artistName: data.artistName
          });
        } else {
          setVtsV4vData(null);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setVtsV4vData(null);
      });

    return () => controller.abort();
  }, [activeVTS?.remoteItem?.feedGuid, activeVTS?.remoteItem?.itemGuid, activeVTS?.remotePercentage, currentPlayingAlbum, currentTrackIndex]);

  // Use isFullscreenMode from AudioContext if isOpen prop is not provided
  const shouldShow = isOpen !== undefined ? isOpen : isFullscreenMode;

  // Get current track info
  const currentTrack = currentPlayingAlbum?.tracks?.[currentTrackIndex];

  // Move video element into visible container when in video mode
  useEffect(() => {
    const videoElement = videoRef?.current;
    const container = videoContainerRef.current;

    if (shouldShow && isVideoMode && videoElement && container) {
      // Store original parent and styles to restore later
      const originalParent = videoElement.parentElement;
      const originalStyles = {
        position: videoElement.style.position,
        left: videoElement.style.left,
        top: videoElement.style.top,
        width: videoElement.style.width,
        height: videoElement.style.height,
        pointerEvents: videoElement.style.pointerEvents,
        opacity: videoElement.style.opacity,
      };

      // Move video into container and make visible
      container.appendChild(videoElement);
      videoElement.style.position = 'relative';
      videoElement.style.left = '0';
      videoElement.style.top = '0';
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.pointerEvents = 'auto';
      videoElement.style.opacity = '1'; // Reset opacity (may have been set to 0.01 during HLS init)
      videoElement.controls = false; // Hide native controls

      return () => {
        // Restore original position when unmounting or switching modes
        if (originalParent && videoElement.parentElement === container) {
          originalParent.appendChild(videoElement);
          videoElement.style.position = originalStyles.position;
          videoElement.style.left = originalStyles.left;
          videoElement.style.top = originalStyles.top;
          videoElement.style.width = originalStyles.width;
          videoElement.style.height = originalStyles.height;
          videoElement.style.pointerEvents = originalStyles.pointerEvents;
          videoElement.style.opacity = originalStyles.opacity;
        }
      };
    }
  }, [shouldShow, isVideoMode, videoRef]);

  // Lock body scroll while fullscreen Now Playing is open.
  // Without this, iOS Safari's elastic bounce reveals the main page behind the
  // fixed overlay when the user scrolls/drags up inside the screen.
  useEffect(() => {
    if (!shouldShow) return;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;

    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;
    const prevHtmlOverscroll = html.style.overscrollBehavior;

    // position: fixed on body is the only reliable way to prevent iOS Safari
    // from scrolling the page behind a fullscreen overlay.
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [shouldShow]);

  // Sync body background to album color while open so iOS elastic overscroll
  // areas show the album color instead of the white page background.
  useEffect(() => {
    if (!shouldShow) return;
    const body = document.body;
    const prev = body.style.backgroundColor;
    // Match the BOTTOM of the screen's gradient (line ~465), not the top, so the
    // bottom overscroll area blends seamlessly with the darker edge above it.
    body.style.backgroundColor = adjustColorBrightness(contrastColors.backgroundColor, -20);
    return () => {
      body.style.backgroundColor = prev;
    };
  }, [shouldShow, contrastColors.backgroundColor]);

  // Debug: Log V4V data availability
  useEffect(() => {
    if (currentTrack) {
      console.log('⚡ NowPlayingScreen V4V Debug:', {
        trackTitle: currentTrack.title,
        hasTrackV4v: !!currentTrack.v4vRecipient || !!currentTrack.v4vValue,
        hasAlbumV4v: !!currentPlayingAlbum?.v4vRecipient || !!currentPlayingAlbum?.v4vValue,
        resolvedAddress: getPrimaryRecipient(currentTrack) || getPrimaryRecipient(currentPlayingAlbum),
      });
    }
  }, [currentTrack]);

  // Check if title overflows its container
  useEffect(() => {
    if (titleRef.current) {
      const overflows = titleRef.current.scrollWidth > titleRef.current.clientWidth;
      setTitleOverflows(overflows);
    }
  }, [currentTrack?.title]);

  // Check if chapter title overflows its container
  useEffect(() => {
    if (chapterTitleRef.current) {
      const overflows = chapterTitleRef.current.scrollWidth > chapterTitleRef.current.clientWidth;
      setChapterTitleOverflows(overflows);
    }
  }, [currentChapterIndex, chapters]);

  // Helper function to proxy external image URLs (same as GlobalNowPlayingBar)
  const getProxiedImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return '';

    // If it's already a local/proxied URL, return as-is
    if (imageUrl.startsWith('/') || imageUrl.includes('/api/proxy-image')) {
      return imageUrl;
    }

    // Proxy external URLs to avoid CORS issues
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  };

  // Helper function to brighten a hex color
  const brightenColor = (hex: string, percent: number): string => {
    // Remove # if present
    const color = hex.replace('#', '');

    // Parse RGB values
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    // Brighten each component
    const brightenComponent = (component: number): number => {
      // If the component is very dark, boost it much more aggressively
      if (component < 30) {
        return Math.min(255, component + (255 - component) * (percent / 100) + 120);
      }
      // For dark components, still boost significantly
      if (component < 80) {
        return Math.min(255, component + (255 - component) * (percent / 100) + 60);
      }
      // For brighter components, use standard brightening
      return Math.min(255, component + (255 - component) * (percent / 100));
    };

    const newR = Math.round(brightenComponent(r));
    const newG = Math.round(brightenComponent(g));
    const newB = Math.round(brightenComponent(b));

    // Convert back to hex
    const toHex = (n: number): string => n.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };

  // Prioritize chapter art, then track image, fallback to album coverArt
  const chapterImg = chapters.length > 0 && currentChapterIndex >= 0
    ? chapters[currentChapterIndex]?.img
    : undefined;
  const originalImageUrl = chapterImg || currentTrack?.image || currentPlayingAlbum?.coverArt || '';

  // Prefer a downloaded cover (cached blob) so art shows offline; falls back to
  // the proxied network URL in `albumArt` below when the cover isn't downloaded.
  useEffect(() => {
    // Clear immediately so we never render a just-revoked blob during the async
    // gap; albumArt falls back to the network URL until the new cover resolves.
    setDownloadedCoverSrc(null);
    if (!downloads || !originalImageUrl) return;
    let cancelled = false;
    let created: string | null = null;
    downloads.getCoverUrl(originalImageUrl).then((blob) => {
      if (cancelled) {
        if (blob) URL.revokeObjectURL(blob);
        return;
      }
      created = blob;
      setDownloadedCoverSrc(blob);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalImageUrl]);

  // For VTS podcasts (playlists), favorite the individual song via remoteItem
  // For regular tracks, favorite via currentTrack.id
  const hasVTS = currentTrack?.valueTimeSplits && currentTrack.valueTimeSplits.length > 0;
  const favoriteTrackId = hasVTS
    ? activeVTS?.remoteItem?.itemGuid  // null if between VTS segments
    : currentTrack?.id;
  const albumArt = downloadedCoverSrc
    ? downloadedCoverSrc
    : originalImageUrl
      ? getProxiedImageUrl(originalImageUrl)
      : '/api/placeholder/400/400';

  // Extract dominant color from album art and ensure good contrast
  useEffect(() => {
    if (albumArt && !albumArt.includes('/api/placeholder/')) {

      // Check database first
      const fetchColors = async () => {
        try {
          // First try to get from database (realtime=true for testing - remove after tuning)
          const response = await fetch(`/api/artwork-colors?imageUrl=${encodeURIComponent(originalImageUrl)}&realtime=true`);

          if (response.ok) {
            const { data } = await response.json();
            setDominantColor(data.enhancedColor);
            setContrastColors({
              backgroundColor: data.backgroundColor,
              textColor: data.textColor
            });
            return;
          }

          // If not in database, process and store it

          const processResponse = await fetch('/api/artwork-colors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: originalImageUrl })
          });

          if (processResponse.ok) {
            const { data } = await processResponse.json();
            setDominantColor(data.enhancedColor);
            setContrastColors({
              backgroundColor: data.backgroundColor,
              textColor: data.textColor
            });
          } else {
            throw new Error('Failed to process color');
          }

        } catch (error) {
          console.warn('🎨 Database color processing failed, using fallback color:', error);

          // Use a deterministic fallback color based on track position
          const vibrantColors = ['#E11D48', '#0EA5E9', '#22C55E', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16', '#EC4899', '#10B981'];
          const colorIndex = (currentTrackIndex || 0) % vibrantColors.length;
          const color = vibrantColors[colorIndex];

          if (process.env.NODE_ENV === 'development') {
            console.log('🎨 Using deterministic fallback color:', color);
          }

          const brightenAmount = 40;
          const brightenedColor = brightenColor(color, brightenAmount);

          if (process.env.NODE_ENV === 'development') {
            console.log('🎨 Brightened fallback color:', brightenedColor, 'from original:', color);
          }

          setDominantColor(brightenedColor);
          const colors = ensureGoodContrast(brightenedColor);
          setContrastColors(colors);
        }
      };

      fetchColors();
    } else {
      const fallbackColor = '#1A252F';
      setDominantColor(fallbackColor);
      setContrastColors({ backgroundColor: fallbackColor, textColor: '#ffffff' });
    }
  }, [albumArt, currentTrackIndex, originalImageUrl, currentTrack?.title]);

  // Handle progress bar interaction
  const handleProgressClick = (e: React.MouseEvent) => {
    if (progressRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * duration;
      seek(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Clamped: a stale/short duration would otherwise push the knob's `left`
  // past 100% and slide it off the right edge of the screen.
  const progress = duration > 0
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : 0;

  if (!shouldShow || !currentPlayingAlbum || !currentTrack) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ height: '100dvh', overscrollBehavior: 'none', WebkitOverflowScrolling: 'auto' }}>
      {/* Solid Color Background - ITDV Style with good contrast */}
      <div
        className="absolute inset-0 transition-all duration-1000 pointer-events-none"
        style={{
          backgroundColor: contrastColors.backgroundColor,
          background: `linear-gradient(180deg, ${contrastColors.backgroundColor} 0%, ${adjustColorBrightness(contrastColors.backgroundColor, -20)} 100%)`
        }}
      />
      
      {/* Content */}
      <div className="relative flex flex-col h-full" style={{
        color: contrastColors.textColor,
        paddingTop: 'max(var(--sk-safe-top), 16px)',
        paddingBottom: 'max(var(--sk-safe-bottom), 20px)',
        paddingLeft: 'var(--sk-safe-left)',
        paddingRight: 'var(--sk-safe-right)'
      }}>
        {/* Header - fixed height; close / album name / menu share one row so the
            album name can never sit on top of the close button */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 pt-1 pb-1">
          <button
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                setFullscreenMode(false);
              }
            }}
            className="flex-shrink-0 p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-200"
            aria-label="Close now playing"
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          {/* Playing from - single line, shares the row instead of overlapping */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Close fullscreen mode first
              if (onClose) {
                onClose();
              } else {
                setFullscreenMode(false);
              }
              // Then navigate to album page
              const albumUrl = generateAlbumHref(currentPlayingAlbum);
              router.push(albumUrl);
            }}
            className="flex-1 min-w-0 truncate text-center text-sm font-medium rounded-lg px-2 py-1 cursor-pointer hover:bg-black/30 active:scale-95 transition-all duration-200"
            style={{
              color: contrastColors.textColor,
              textShadow: '0 2px 4px rgba(0,0,0,0.8)'
            }}
            title={currentPlayingAlbum.title}
          >
            {currentPlayingAlbum.title}
          </button>

          {/* User Menu - avatar only, which is now UserMenu's behaviour everywhere */}
          <UserMenu />
        </div>

        {/* Album Art or Video - the one flexible row, so a short screen shrinks the
            artwork instead of clipping the transport controls off the bottom.
            Sized to min(width, height) so it stays 1:1 and never stretches. */}
        <div
          className="flex-1 min-h-0 grid place-items-center px-6 py-2"
          style={{ containerType: 'size' }}
        >
          <div
            className="relative aspect-square"
            style={{ width: 'min(100cqw, 100cqh)', maxWidth: '24rem' }}
          >
            {isVideoMode ? (
              <div
                ref={videoContainerRef}
                className="w-full h-full rounded-2xl shadow-2xl overflow-hidden bg-black"
                style={{
                  boxShadow: `0 25px 50px ${dominantColor}30`
                }}
              />
            ) : (
              <img
                src={albumArt}
                alt={currentPlayingAlbum.title}
                className="w-full h-full object-cover rounded-2xl shadow-2xl pointer-events-none"
                style={{
                  boxShadow: `0 25px 50px ${dominantColor}30`
                }}
              />
            )}

            {/* Reflection effect */}
            <div
              className="absolute -bottom-4 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-black/20 rounded-b-2xl pointer-events-none"
              style={{
                background: `linear-gradient(to bottom, transparent 0%, ${dominantColor}10 100%)`
              }}
            />
          </div>
        </div>

        {/* Track actions - favorite / boost / download. These used to float on the
            artwork corners, where they covered cover-art titles. */}
        <div
          className="flex-shrink-0 flex items-center justify-center gap-5 px-6 pt-3"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {favoriteTrackId && (
            <div
              className="backdrop-blur-md rounded-full flex items-center justify-center touch-manipulation active:scale-95 transition-all shadow-xl flex-shrink-0"
              style={{
                width: 48, height: 48,
                backgroundColor: 'rgba(0,0,0,0.6)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.1)'
              }}
            >
              <FavoriteButton
                key={favoriteTrackId}
                trackId={favoriteTrackId}
                feedGuidForImport={hasVTS ? activeVTS?.remoteItem?.feedGuid : undefined}
                size={28}
                className="text-white"
              />
            </div>
          )}

          <button
            className="flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg touch-manipulation flex-shrink-0"
            style={{
              width: 56, height: 56,
              backgroundColor: '#FBBF24',
              color: '#000000',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            onClick={() => setShowBoostModal(true)}
            title="Send a boost"
          >
            <Zap size={24} className="pointer-events-none" fill="#000000" />
          </button>

          {!hasVTS && currentTrack?.url ? (
            <div
              className="backdrop-blur-md rounded-full flex items-center justify-center touch-manipulation active:scale-95 transition-all shadow-xl flex-shrink-0"
              style={{
                width: 48, height: 48,
                backgroundColor: 'rgba(0,0,0,0.6)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.1)'
              }}
            >
              <DownloadButton
                downloadTarget={{ type: 'track', track: currentTrack as any }}
                size={28}
                className="text-white"
              />
            </div>
          ) : null}
        </div>

        {/* Track Info */}
        <div className="flex-shrink-0 px-8 pt-3 text-center">
          <div className="overflow-hidden">
            <h1
              ref={titleRef}
              className={`text-2xl font-bold mb-2 whitespace-nowrap ${titleOverflows ? 'animate-marquee hover:animate-none' : ''}`}
            >
              <Link href={`${generateAlbumHref(currentPlayingAlbum)}${currentTrack.id ? `?track=${currentTrack.id}` : ''}`} className="hover:underline">
                {currentTrack.title || 'Unknown Track'}
              </Link>
              {titleOverflows && (
                <>
                  <span className="px-8" />
                  <Link href={`${generateAlbumHref(currentPlayingAlbum)}${currentTrack.id ? `?track=${currentTrack.id}` : ''}`} className="hover:underline">
                    {currentTrack.title || 'Unknown Track'}
                  </Link>
                </>
              )}
            </h1>
          </div>
          <p className="text-lg opacity-80 truncate">
            {currentTrack.artist || currentPlayingAlbum.artist || 'Unknown Artist'}
          </p>
          {chapters.length > 0 && currentChapterIndex >= 0 && chapters[currentChapterIndex] && (
            <div className="overflow-hidden">
              <p
                ref={chapterTitleRef}
                className={`text-sm opacity-60 mt-1 whitespace-nowrap ${chapterTitleOverflows ? 'animate-marquee hover:animate-none' : ''}`}
              >
                Ch. {currentChapterIndex + 1}/{chapters.length}: {chapters[currentChapterIndex].title}
                {chapterTitleOverflows && (
                  <>
                    <span className="px-8" />
                    Ch. {currentChapterIndex + 1}/{chapters.length}: {chapters[currentChapterIndex].title}
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="flex-shrink-0 px-8 pt-4">
          <div
            ref={progressRef}
            className="relative h-1 rounded-full cursor-pointer"
            style={{
              backgroundColor: `${contrastColors.textColor}30`
            }}
            onClick={handleProgressClick}
          >
            <div
              className="absolute h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                backgroundColor: contrastColors.textColor
              }}
            />
            {/* Chapter tick marks */}
            {chapters.length > 1 && duration > 0 && chapters
              .filter((_, i) => i > 0)
              .map((chapter) => (
                <div
                  key={chapter.startTime}
                  className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 rounded-full pointer-events-none"
                  style={{
                    left: `${(chapter.startTime / duration) * 100}%`,
                    backgroundColor: `${contrastColors.textColor}60`,
                  }}
                />
              ))}
            <div
              className="absolute w-3 h-3 rounded-full shadow-lg transform -translate-y-1/2 transition-all duration-100"
              style={{
                left: `${progress}%`,
                transform: `translateX(-50%) translateY(-50%)`,
                backgroundColor: contrastColors.textColor,
                boxShadow: `0 4px 12px rgba(0,0,0,0.3)`
              }}
            />
          </div>
          
          {/* Time Labels */}
          <div className="flex justify-between text-sm opacity-60 mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 px-8 pt-3">
          {/* Center Controls */}
          <div className="flex items-center justify-between w-full mx-auto" style={{ maxWidth: 'min(320px, 100%)' }}>
            {/* Shuffle Button */}
            <button
              onClick={toggleShuffle}
              className="rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0"
              style={{
                width: 40, height: 40,
                backgroundColor: isShuffleMode
                  ? `${contrastColors.textColor}30`
                  : `${contrastColors.textColor}10`,
                color: isShuffleMode
                  ? contrastColors.textColor
                  : `${contrastColors.textColor}60`
              }}
            >
              <Shuffle size={20} />
            </button>

            {/* Previous Button */}
            <button
              onClick={playPreviousTrack}
              className="rounded-full transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center flex-shrink-0"
              style={{
                width: 52, height: 52,
                backgroundColor: `${contrastColors.textColor}20`,
                color: contrastColors.textColor
              }}
            >
              <SkipBack size={24} />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={isPlaying ? pause : resume}
              className="rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center flex-shrink-0"
              style={{
                width: 64, height: 64,
                backgroundColor: contrastColors.textColor,
                boxShadow: `0 8px 25px rgba(0,0,0,0.3)`
              }}
            >
              {isPlaying ? (
                <Pause size={32} style={{ color: contrastColors.backgroundColor }} />
              ) : (
                <Play size={32} className="ml-1" style={{ color: contrastColors.backgroundColor }} />
              )}
            </button>

            {/* Next Button */}
            <button
              onClick={playNextTrack}
              className="rounded-full transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center flex-shrink-0"
              style={{
                width: 52, height: 52,
                backgroundColor: `${contrastColors.textColor}20`,
                color: contrastColors.textColor
              }}
            >
              <SkipForward size={24} />
            </button>

            {/* Repeat Button */}
            <button
              onClick={() => {
                // Cycle through repeat modes: none -> all -> one -> none
                const nextMode = repeatMode === 'none' ? 'all' :
                                repeatMode === 'all' ? 'one' :
                                'none';
                console.log('🔂 Fullscreen repeat button clicked:', { currentMode: repeatMode, nextMode });
                setRepeatMode(nextMode);
              }}
              className="rounded-full transition-all duration-200 relative flex items-center justify-center flex-shrink-0"
              style={{
                width: 40, height: 40,
                backgroundColor: repeatMode !== 'none'
                  ? `${contrastColors.textColor}30`
                  : `${contrastColors.textColor}10`,
                color: repeatMode !== 'none'
                  ? contrastColors.textColor
                  : `${contrastColors.textColor}60`
              }}
              title={
                repeatMode === 'none' ? 'Enable repeat' :
                repeatMode === 'one' ? 'Repeat one' :
                'Repeat all'
              }
            >
              <Repeat size={20} />
              {repeatMode === 'one' && (
                <span
                  className="absolute -top-1 -right-1 text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: contrastColors.textColor,
                    color: contrastColors.backgroundColor
                  }}
                >
                  1
                </span>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* Boost Modal */}
      {showBoostModal && currentTrack && (
        <BoostButton
          trackId={currentTrack.id}
          feedId={currentPlayingAlbum.feedId || currentPlayingAlbum.id}
          trackTitle={activeVTS ? (chapters[currentChapterIndex]?.title || currentTrack.title) : currentTrack.title}
          artistName={vtsV4vData?.artistName || currentTrack.artist || currentPlayingAlbum.artist || 'Unknown Artist'}
          lightningAddress={vtsV4vData?.lightningAddress || getPrimaryRecipient(currentTrack) || getPrimaryRecipient(currentPlayingAlbum)}
          valueSplits={vtsV4vData?.valueSplits || formatValueSplitsForBoost(currentTrack, currentPlayingAlbum.artist) || formatValueSplitsForBoost(currentPlayingAlbum, currentPlayingAlbum.artist) || []}
          autoOpen={true}
          onClose={() => setShowBoostModal(false)}
          feedUrl={currentPlayingAlbum.feedUrl || currentPlayingAlbum.link}
          episodeGuid={activeVTS?.remoteItem?.itemGuid || currentTrack.v4vValue?.itemGuid || currentTrack.guid}
          remoteFeedGuid={activeVTS?.remoteItem?.feedGuid || currentTrack.v4vValue?.feedGuid || currentPlayingAlbum.feedGuid}
          albumName={(currentTrack as any).feedTitle || (currentTrack as any).albumTitle || currentPlayingAlbum.title}
          publisherGuid={(currentPlayingAlbum as any).publisher?.feedGuid}
          remoteStartTime={activeVTS ? activeVTS.startTime : currentTrack.v4vValue?.remoteStartTime}
          persons={[
            ...((currentTrack as any).persons || []),
            ...((currentPlayingAlbum as any).persons || []),
          ]}
        />
      )}
    </div>
  );
}