'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/Toast';
import { useNostr } from '@/contexts/NostrContext';
import { getUnifiedSigner } from '@/lib/nostr/signer';

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [addingFeed, setAddingFeed] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [feedTypeOverride, setFeedTypeOverride] = useState<string>('auto');
  const [verifying, setVerifying] = useState(false);
  const [recentFeeds, setRecentFeeds] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [showImportResultModal, setShowImportResultModal] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [reparsingFeeds, setReparsingFeeds] = useState<Set<string>>(new Set());
  const [reparseFeedUrl, setReparseFeedUrl] = useState('');
  const [reparsingByUrl, setReparsingByUrl] = useState(false);

  // Delete by URL state
  const [deleteUrl, setDeleteUrl] = useState('');
  const [deletingByUrl, setDeletingByUrl] = useState(false);
  const [deletePreview, setDeletePreview] = useState<{
    found: boolean;
    feed?: { id: string; title: string; artist: string; image?: string; trackCount: number };
    slug?: string;
    message?: string;
  } | null>(null);

  // Bulk import state
  const [bulkSearching, setBulkSearching] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<{
    query: string;
    type?: string;
    totalFound: number;
    newFeeds: number;
    existingFeeds: number;
    blacklistedFeeds: number;
    feeds: Array<{
      piId: number;
      title: string;
      author: string;
      image: string;
      feedUrl: string;
      medium: string;
      episodeCount: number;
      alreadyExists: boolean;
      isBlacklisted: boolean;
      existingFeedId?: string;
    }>;
  } | null>(null);
  const [bulkImportProgress, setBulkImportProgress] = useState<{
    current: number;
    total: number;
    imported: number;
    skipped: number;
    failed: number;
    currentFeed?: string;
    currentStatus?: string;
  } | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    total: number;
    results: Array<{
      feedUrl: string;
      status: string;
      title?: string;
      artist?: string;
      trackCount?: number;
      feedId?: string;
      error?: string;
    }>;
  } | null>(null);
  const [bulkSelectedFeeds, setBulkSelectedFeeds] = useState<Set<string>>(new Set());

  // Orphan cleanup state
  const [parsingMissingTracks, setParsingMissingTracks] = useState(false);
  const [parseProgress, setParseProgress] = useState<{
    current: number;
    total: number;
    feedTitle?: string;
    parsed: number;
    failed: number;
    totalTracks: number;
  } | null>(null);
  const [parseResult, setParseResult] = useState<{
    total: number;
    parsed: number;
    failed: number;
    totalTracks: number;
  } | null>(null);
  const [failedFeeds, setFailedFeeds] = useState<Array<{
    feedId: string;
    feedUrl: string | null;
    reason: string;
    message: string | null;
    severity: 'error' | 'info';
  }>>([]);
  const [showFailedFeeds, setShowFailedFeeds] = useState(false);
  const [checkingOrphans, setCheckingOrphans] = useState(false);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [orphanPreview, setOrphanPreview] = useState<{
    feedsToKeep: number;
    orphanedFeeds: number;
    orphanedTracks: number;
    totalFeeds: number;
    totalTracks: number;
    sampleOrphanedFeeds: Array<{
      id: string;
      title: string;
      artist: string;
      image?: string;
      type: string;
      trackCount: number;
    }>;
  } | null>(null);

  // Nostr authentication
  const { user: nostrUser, isAuthenticated: isNostrAuthenticated, isLoading: nostrLoading } = useNostr();

  // Admin authentication state (separate from Nostr auth)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Verify admin access - requires signing a challenge to prove key ownership
  const verifyAdminAccess = useCallback(async (npub: string, pubkey: string) => {
    setVerifying(true);
    try {
      // Step 1: Verify key ownership by signing a challenge
      const signer = getUnifiedSigner();
      await signer.ensureInitialized();

      if (!signer.isAvailable()) {
        toast.error('No Nostr signer available. Please connect your extension or signer app.');
        setVerifying(false);
        setLoading(false);
        return;
      }

      // Create and sign a challenge event
      const challenge = `stablekraft-admin-verify-${Date.now()}`;
      const eventTemplate = {
        kind: 27235, // NIP-98 HTTP Auth kind
        created_at: Math.floor(Date.now() / 1000),
        tags: [['u', window.location.href], ['method', 'GET']],
        content: challenge,
        pubkey: pubkey,
      };

      const signedEvent = await signer.signEvent(eventTemplate as any);

      if (!signedEvent?.sig || signedEvent.pubkey !== pubkey) {
        toast.error('Key verification failed. Signature does not match.');
        setVerifying(false);
        setLoading(false);
        return;
      }

      // Step 2: Check admin whitelist
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ npub, pubkey }),
      });

      const data = await response.json();

      if (data.success && data.authorized) {
        setIsAdminAuthenticated(true);
        localStorage.setItem('admin-authenticated', 'true');
        localStorage.setItem('admin-npub', npub);
      } else {
        setIsAdminAuthenticated(false);
        localStorage.removeItem('admin-authenticated');
        localStorage.removeItem('admin-npub');

        // Show specific error message if ADMIN_NPUBS is not configured
        if (response.status === 500 && data.error === 'No admin npubs configured') {
          toast.error('Admin access is not configured. Please set ADMIN_NPUBS environment variable.');
        } else if (response.status === 403) {
          toast.error('Your Nostr account is not whitelisted for admin access.');
        } else if (data.error) {
          toast.error(data.error);
        }
      }
    } catch (error) {
      console.error('Error verifying admin access:', error);
      setIsAdminAuthenticated(false);
      localStorage.removeItem('admin-authenticated');
      localStorage.removeItem('admin-npub');
      toast.error('Failed to verify admin access. Please try again.');
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  }, []);

  // When Nostr user logs in, automatically verify admin access
  useEffect(() => {
    if (nostrLoading) return;

    if (!isNostrAuthenticated || !nostrUser) {
      // Not authenticated, clear admin auth
      setIsAdminAuthenticated(false);
      localStorage.removeItem('admin-authenticated');
      localStorage.removeItem('admin-npub');
      setLoading(false);
    } else {
      // User is logged in, verify admin access (includes key ownership check)
      verifyAdminAccess(nostrUser.nostrNpub, nostrUser.nostrPubkey);
    }
  }, [nostrLoading, isNostrAuthenticated, nostrUser?.nostrNpub, nostrUser?.nostrPubkey, verifyAdminAccess]);

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem('admin-authenticated');
    localStorage.removeItem('admin-npub');
  };

  const fetchRecentFeeds = async () => {
    setLoadingRecent(true);
    try {
      const response = await fetch('/api/feeds?limit=5&sortBy=recent');
      const data = await response.json();
      if (data.feeds) {
        setRecentFeeds(data.feeds);
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Refreshed recent feeds:', data.feeds.length);
        }
      } else {
        toast.error('Failed to load recent feeds');
      }
    } catch (error) {
      console.error('Error fetching recent feeds:', error);
      toast.error('Network error loading recent feeds');
    } finally {
      setLoadingRecent(false);
    }
  };

  // Fetch recent feeds when authenticated
  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchRecentFeeds();
    }
  }, [isAdminAuthenticated]);



  const reparseFeed = async (feedId: string) => {
    setReparsingFeeds(prev => new Set(prev).add(feedId));

    try {
      const response = await fetch(`/api/admin/feeds/${feedId}/reparse`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        const msgs = [];
        if (data.newTracks > 0) msgs.push(`Added ${data.newTracks} new tracks`);
        if (data.updatedTracks > 0) msgs.push(`Updated ${data.updatedTracks} existing tracks`);
        if (data.v4vUpdated > 0) msgs.push(`Refreshed ${data.v4vUpdated} payment splits`);
        if (msgs.length === 0) msgs.push('No changes needed');
        toast.success(`Feed reparsed! ${msgs.join('. ')}.`);
        // Refresh the recent feeds list
        fetchRecentFeeds();
      } else {
        toast.error(data.error || 'Failed to reparse feed. Please try again.');
      }
    } catch (error) {
      console.error('Error reparsing feed:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setReparsingFeeds(prev => {
        const next = new Set(prev);
        next.delete(feedId);
        return next;
      });
    }
  };

  const reparseByUrl = async (e: React.FormEvent) => {
    e.preventDefault();

    const feedUrl = reparseFeedUrl.trim();

    if (!feedUrl) {
      toast.error('Please enter a RSS feed URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(feedUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setReparsingByUrl(true);

    try {
      // Use the refresh-by-url endpoint which will find the feed by URL and reparse it
      const response = await fetch('/api/feeds/refresh-by-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalUrl: feedUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if this is the HGH playlist and clear its cache
        if (feedUrl.includes('HGH-music-playlist.xml') || feedUrl.includes('chadf-musicl-playlists')) {
          try {
            await fetch('/api/playlist-cache?clear=hgh-playlist', {
              method: 'DELETE',
            });
            console.log('✅ Cleared HGH playlist cache');
          } catch (cacheError) {
            console.warn('⚠️ Failed to clear HGH playlist cache:', cacheError);
          }
        }

        const messages = [];
        if (data.newTracks > 0) messages.push(`Added ${data.newTracks} new tracks`);
        if (data.updatedTracks > 0) messages.push(`Updated ${data.updatedTracks} existing tracks`);
        if (data.v4vUpdated > 0) messages.push(`Refreshed ${data.v4vUpdated} payment splits`);
        if (messages.length === 0) messages.push('No changes needed');
        toast.success(`Feed reparsed! ${messages.join('. ')}. Total: ${data.totalTracks} tracks`);
        setReparseFeedUrl('');
        // Refresh the recent feeds list
        fetchRecentFeeds();
      } else {
        toast.error(data.error || 'Failed to reparse feed. Please check the URL and try again.');
      }
    } catch (error) {
      console.error('Error reparsing feed:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setReparsingByUrl(false);
    }
  };

  // Check if a URL is a Podcast Index search URL
  const isPodcastIndexSearchUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return (
        (parsed.hostname === 'podcastindex.org' || parsed.hostname === 'www.podcastindex.org') &&
        parsed.pathname === '/search' &&
        !!parsed.searchParams.get('q')
      );
    } catch {
      return false;
    }
  };

  // Search PI and show preview
  const searchBulkFeeds = async (url: string) => {
    setBulkSearching(true);
    setBulkPreview(null);
    setBulkImportResult(null);
    setBulkImportProgress(null);

    try {
      const response = await fetch(`/api/admin/bulk-import?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to search Podcast Index');
        return;
      }

      if (data.feeds.length === 0) {
        toast.info('No feeds found for this search');
        return;
      }

      setBulkPreview(data);
      // Pre-select all new (non-existing, non-blacklisted) feeds
      const newFeedUrls = data.feeds
        .filter((f: any) => !f.alreadyExists && !f.isBlacklisted)
        .map((f: any) => f.feedUrl);
      setBulkSelectedFeeds(new Set(newFeedUrls));
    } catch (error) {
      console.error('Error searching bulk feeds:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setBulkSearching(false);
    }
  };

  // Import selected feeds with SSE progress
  const importBulkFeeds = async () => {
    if (bulkSelectedFeeds.size === 0) {
      toast.error('No feeds selected for import');
      return;
    }

    setBulkImporting(true);
    setBulkImportProgress(null);
    setBulkImportResult(null);

    try {
      const feedUrls = Array.from(bulkSelectedFeeds);
      const response = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrls, type: 'album' }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        toast.error('Failed to start bulk import');
        setBulkImporting(false);
        return;
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'start') {
                setBulkImportProgress({
                  current: 0,
                  total: data.total,
                  imported: 0,
                  skipped: 0,
                  failed: 0,
                });
              } else if (data.type === 'progress') {
                setBulkImportProgress({
                  current: data.current,
                  total: data.total,
                  imported: data.imported,
                  skipped: data.skipped,
                  failed: data.failed,
                  currentFeed: data.title || data.feedUrl,
                  currentStatus: data.status,
                });
              } else if (data.type === 'complete') {
                setBulkImportResult({
                  imported: data.imported,
                  skipped: data.skipped,
                  failed: data.failed,
                  total: data.total,
                  results: data.results,
                });
                setBulkImportProgress(null);

                if (data.imported > 0) {
                  toast.success(`Imported ${data.imported} feeds! (${data.skipped} skipped, ${data.failed} failed)`);
                } else {
                  toast.info(`No new feeds imported. ${data.skipped} already existed.`);
                }

                fetchRecentFeeds();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during bulk import:', error);
      toast.error('Bulk import failed. Please try again.');
    } finally {
      setBulkImporting(false);
      setBulkImportProgress(null);
    }
  };

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();

    const feedUrl = newFeedUrl.trim();

    if (!feedUrl) {
      toast.error('Please enter a RSS feed URL');
      return;
    }

    // Detect Podcast Index search URLs → redirect to bulk import flow
    if (isPodcastIndexSearchUrl(feedUrl)) {
      searchBulkFeeds(feedUrl);
      return;
    }

    // Basic URL validation
    try {
      const parsed = new URL(feedUrl);
      // Reject stablekraft.app site URLs — these are pages, not RSS feeds
      if (parsed.hostname === 'stablekraft.app' || parsed.hostname === 'www.stablekraft.app') {
        toast.error('That\'s a site page URL, not an RSS feed URL. Use the actual XML feed URL instead.');
        return;
      }
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setAddingFeed(true);

    try {
      // Use manual override if set, otherwise auto-detect from URL patterns
      let detectedType = feedTypeOverride !== 'auto' ? feedTypeOverride : 'album';
      if (feedTypeOverride === 'auto') {
        if (feedUrl.includes('/artist/') || feedUrl.includes('/publisher') || feedUrl.includes('-pubfeed') || feedUrl.includes('publisher-feed')) {
          detectedType = 'publisher';
        } else if (feedUrl.includes('/playlist/')) {
          detectedType = 'playlist';
        }
      }

      // Use the main feeds API which parses tracks automatically
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalUrl: feedUrl,
          type: detectedType,
          priority: 'normal',
          cdnUrl: ''
        }),
      });

      const data = await response.json();

      if (response.ok || response.status === 206) {
        // Show modal with import results
        setImportResult({
          success: response.ok,
          warning: response.status === 206,
          feed: data.feed,
          publisherFeed: data.publisherFeed,
          importedPublisherFeed: data.importedPublisherFeed,
          linkedAlbums: data.linkedAlbums
        });
        setShowImportResultModal(true);
        setNewFeedUrl('');
        // Refresh the recent feeds list
        fetchRecentFeeds();
      } else if (response.status === 409) {
        // Feed already exists - automatically reparse it
        toast.info('Feed exists, reparsing...');

        const reparseResponse = await fetch('/api/feeds/refresh-by-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalUrl: feedUrl,
          }),
        });

        const reparseData = await reparseResponse.json();

        if (reparseResponse.ok) {
          const messages = [];
          if (reparseData.newTracks > 0) messages.push(`Added ${reparseData.newTracks} new tracks`);
          if (reparseData.updatedTracks > 0) messages.push(`Updated ${reparseData.updatedTracks} existing tracks`);
          if (reparseData.v4vUpdated > 0) messages.push(`Refreshed ${reparseData.v4vUpdated} payment splits`);
          if (messages.length === 0) messages.push('No changes needed');
          toast.success(`Feed reparsed! ${messages.join('. ')}. Total: ${reparseData.totalTracks} tracks`);
          setNewFeedUrl('');
          fetchRecentFeeds();
        } else {
          toast.error(reparseData.error || 'Failed to reparse feed');
        }
      } else {
        toast.error(data.error || 'Failed to add feed. Please check the URL and try again.');
      }
    } catch (error) {
      console.error('Error adding feed:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setAddingFeed(false);
    }
  };

  const previewDeleteByUrl = async () => {
    const url = deleteUrl.trim();
    if (!url) {
      toast.error('Please enter a URL');
      return;
    }

    setDeletingByUrl(true);
    setDeletePreview(null);

    try {
      const response = await fetch('/api/admin/feeds/delete-by-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, preview: true }),
      });

      const data = await response.json();
      setDeletePreview(data);

      if (!data.found) {
        toast.info(data.message || 'No feed found for this URL');
      }
    } catch (error) {
      console.error('Error previewing delete:', error);
      toast.error('Failed to look up feed');
    } finally {
      setDeletingByUrl(false);
    }
  };

  const confirmDeleteByUrl = async () => {
    if (!deletePreview?.found || !deletePreview.feed) {
      toast.error('No feed selected for deletion');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${deletePreview.feed.title}" by ${deletePreview.feed.artist}?\n\nThis will remove the feed and all ${deletePreview.feed.trackCount} tracks. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingByUrl(true);

    try {
      const response = await fetch('/api/admin/feeds/delete-by-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: deleteUrl.trim(), preview: false }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Deleted "${data.deleted.title}" by ${data.deleted.artist} (${data.deleted.trackCount} tracks)`);
        setDeleteUrl('');
        setDeletePreview(null);
        fetchRecentFeeds();
      } else {
        toast.error(data.error || 'Failed to delete feed');
      }
    } catch (error) {
      console.error('Error deleting feed:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setDeletingByUrl(false);
    }
  };

  const parseMissingTracks = async () => {
    setParsingMissingTracks(true);
    setParseResult(null);
    setParseProgress(null);
    setFailedFeeds([]);
    setShowFailedFeeds(false);

    try {
      const response = await fetch('/api/playlist/parse-feeds-stream');
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        toast.error('Failed to start parsing');
        setParsingMissingTracks(false);
        return;
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'start') {
                setParseProgress({
                  current: 0,
                  total: data.total,
                  parsed: 0,
                  failed: 0,
                  totalTracks: 0
                });
              } else if (data.type === 'progress') {
                setParseProgress({
                  current: data.current,
                  total: data.total,
                  feedTitle: data.feedTitle,
                  parsed: data.parsed,
                  failed: data.failed,
                  totalTracks: data.totalTracks
                });
              } else if (data.type === 'complete') {
                setParseResult({
                  total: data.parsed + data.failed,
                  parsed: data.parsed,
                  failed: data.failed,
                  totalTracks: data.totalTracks
                });
                setParseProgress(null);
                if (data.parsed > 0) {
                  toast.success(`Parsed ${data.parsed} feeds, imported ${data.totalTracks} tracks`);
                } else if (data.parsed === 0 && data.failed === 0) {
                  toast.info('No feeds with missing tracks found');
                } else {
                  toast.warning(`Found feeds but failed to parse any`);
                }
                setOrphanPreview(null);
              } else if (data.type === 'feedError' || data.type === 'feedInfo') {
                const severity: 'error' | 'info' = data.type === 'feedInfo' ? 'info' : 'error';
                setFailedFeeds(prev => [...prev, {
                  feedId: data.feedId,
                  feedUrl: data.feedUrl ?? null,
                  reason: data.reason,
                  message: data.message ?? null,
                  severity,
                }]);
                if (severity === 'error') {
                  console.warn(`[parse-feeds] ${data.reason}: ${data.feedId}`, data);
                } else {
                  console.info(`[parse-feeds] ${data.reason}: ${data.feedId}`, data);
                }
              } else if (data.error) {
                toast.error(data.error);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing feeds:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setParsingMissingTracks(false);
      setParseProgress(null);
    }
  };

  const checkForOrphans = async () => {
    setCheckingOrphans(true);
    setOrphanPreview(null);

    try {
      const response = await fetch('/api/admin/orphaned-items');
      const data = await response.json();

      if (response.ok) {
        setOrphanPreview(data);
        if (data.orphanedFeeds === 0) {
          toast.success('No orphaned items found - database is clean!');
        }
      } else {
        toast.error(data.error || 'Failed to check for orphaned items');
      }
    } catch (error) {
      console.error('Error checking orphans:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setCheckingOrphans(false);
    }
  };

  const deleteOrphanedItems = async () => {
    if (!orphanPreview || orphanPreview.orphanedFeeds === 0) {
      toast.error('No orphaned items to delete');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${orphanPreview.orphanedFeeds} orphaned feeds and ${orphanPreview.orphanedTracks} orphaned tracks?\n\nThis will remove all items NOT referenced by any system playlist.\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingOrphans(true);

    try {
      const response = await fetch('/api/admin/orphaned-items', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Deleted ${data.deletedFeeds} feeds and ${data.deletedTracks} tracks. ${data.remainingFeeds} feeds remain.`);
        setOrphanPreview(null);
        fetchRecentFeeds();
      } else {
        toast.error(data.error || 'Failed to delete orphaned items');
      }
    } catch (error) {
      console.error('Error deleting orphans:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setDeletingOrphans(false);
    }
  };

  // Show loading state
  if (loading || nostrLoading || verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-4 text-lg">
              {verifying ? 'Verifying admin access...' : 'Loading...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied if not authenticated
  if (!isNostrAuthenticated || !isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-2">Admin Access</h1>
          {!isNostrAuthenticated ? (
            <p className="text-gray-400">
              Please log in with Nostr to access this page.
            </p>
          ) : (
            <p className="text-gray-400">
              Your account is not authorized for admin access.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="px-4 py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </a>
              <h1 className="text-4xl font-bold">RSS Feed Management</h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm font-medium"
              title="Logout"
            >
              Logout
            </button>
          </div>
          <p className="text-gray-400 mb-4">
            Manage RSS feeds for the music catalog.
          </p>
        </div>

        {/* Add/Update Feed Form - Smart single input */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Add or Update Feed</h2>
          <form onSubmit={addFeed} className="space-y-4">
            <div>
              <label htmlFor="feedUrl" className="block text-sm font-medium text-gray-300 mb-2">
                Paste RSS Feed URL
              </label>
              <div className="space-y-2">
                <input
                  type="url"
                  id="feedUrl"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData('text');
                    if (pastedText.trim()) {
                      e.preventDefault();
                      setNewFeedUrl(pastedText.trim());
                    }
                  }}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={addingFeed}
                  required
                  autoFocus
                />
                <div className="flex gap-2">
                  <select
                    value={feedTypeOverride}
                    onChange={(e) => setFeedTypeOverride(e.target.value)}
                    disabled={addingFeed}
                    className="flex-1 px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="auto" className="bg-gray-800">Auto-detect</option>
                    <option value="album" className="bg-gray-800">Album</option>
                    <option value="publisher" className="bg-gray-800">Publisher</option>
                    <option value="podcast" className="bg-gray-800">Podcast</option>
                  </select>
                  <button
                    type="submit"
                    disabled={addingFeed || bulkSearching || !newFeedUrl.trim()}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {addingFeed || bulkSearching ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {bulkSearching ? 'Searching...' : 'Processing...'}
                      </>
                    ) : isPodcastIndexSearchUrl(newFeedUrl.trim()) ? (
                      'Search & Import'
                    ) : (
                      'Add / Update'
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Paste any RSS feed URL, Podcast Index link (e.g., podcastindex.org/podcast/12345), or PI search page URL (e.g., podcastindex.org/search?q=...) for bulk import. New feeds will be added and parsed. Existing feeds will be reparsed.
              </p>
            </div>
          </form>
        </div>

        {/* Bulk Import Preview */}
        {(bulkPreview || bulkImportProgress || bulkImportResult) && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-green-500/30 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-green-400">
                Bulk Import from Podcast Index
              </h2>
              <button
                onClick={() => {
                  setBulkPreview(null);
                  setBulkImportProgress(null);
                  setBulkImportResult(null);
                  setBulkSelectedFeeds(new Set());
                }}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Info */}
            {bulkPreview && (
              <div className="mb-4">
                <p className="text-sm text-gray-300">
                  Search: <span className="text-white font-medium">&quot;{bulkPreview.query}&quot;</span>
                  {bulkPreview.type && (
                    <span className="ml-2 px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded text-xs">
                      {bulkPreview.type}
                    </span>
                  )}
                </p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-gray-400">
                    Found: <span className="text-white font-medium">{bulkPreview.totalFound}</span>
                  </span>
                  <span className="text-green-400">
                    New: {bulkPreview.newFeeds}
                  </span>
                  <span className="text-blue-400">
                    Existing: {bulkPreview.existingFeeds}
                  </span>
                  {bulkPreview.blacklistedFeeds > 0 && (
                    <span className="text-red-400">
                      Blacklisted: {bulkPreview.blacklistedFeeds}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Import Progress */}
            {bulkImportProgress && (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Importing {bulkImportProgress.current} of {bulkImportProgress.total}</span>
                  <span>{Math.round((bulkImportProgress.current / bulkImportProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkImportProgress.current / bulkImportProgress.total) * 100}%` }}
                  />
                </div>
                {bulkImportProgress.currentFeed && (
                  <p className="text-xs text-gray-500 truncate">
                    {bulkImportProgress.currentStatus === 'imported' ? '✅' :
                     bulkImportProgress.currentStatus === 'skipped' ? '⏭️' : '❌'}{' '}
                    {bulkImportProgress.currentFeed}
                  </p>
                )}
                <div className="flex gap-4 text-xs">
                  <span className="text-green-400">{bulkImportProgress.imported} imported</span>
                  <span className="text-blue-400">{bulkImportProgress.skipped} skipped</span>
                  <span className="text-red-400">{bulkImportProgress.failed} failed</span>
                </div>
              </div>
            )}

            {/* Import Results Summary */}
            {bulkImportResult && (
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-green-500/10 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{bulkImportResult.imported}</p>
                    <p className="text-xs text-gray-400">Imported</p>
                  </div>
                  <div className="bg-blue-500/10 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{bulkImportResult.skipped}</p>
                    <p className="text-xs text-gray-400">Skipped</p>
                  </div>
                  <div className="bg-red-500/10 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{bulkImportResult.failed}</p>
                    <p className="text-xs text-gray-400">Failed</p>
                  </div>
                </div>

                {/* Detailed results list */}
                {bulkImportResult.results.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {bulkImportResult.results.map((result, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-white/5">
                        <span>{result.status === 'imported' ? '✅' : result.status === 'skipped' ? '⏭️' : '❌'}</span>
                        <span className="flex-1 truncate text-gray-300">
                          {result.title || result.feedUrl}
                        </span>
                        {result.artist && (
                          <span className="text-gray-500 truncate max-w-[120px]">{result.artist}</span>
                        )}
                        {result.trackCount !== undefined && (
                          <span className="text-gray-500">{result.trackCount}t</span>
                        )}
                        {result.error && (
                          <span className="text-red-400 truncate max-w-[150px]">{result.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Feed List with Checkboxes */}
            {bulkPreview && !bulkImportProgress && !bulkImportResult && (
              <div className="space-y-3">
                {/* Select All / None */}
                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => {
                      const allNew = bulkPreview.feeds
                        .filter(f => !f.alreadyExists && !f.isBlacklisted)
                        .map(f => f.feedUrl);
                      setBulkSelectedFeeds(new Set(allNew));
                    }}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Select all new
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={() => setBulkSelectedFeeds(new Set())}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Select none
                  </button>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-400">
                    {bulkSelectedFeeds.size} selected
                  </span>
                </div>

                {/* Feed List */}
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {bulkPreview.feeds.map((feed) => {
                    const isSelected = bulkSelectedFeeds.has(feed.feedUrl);
                    const isDisabled = feed.alreadyExists || feed.isBlacklisted;

                    return (
                      <label
                        key={feed.piId}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isDisabled
                            ? 'bg-white/2 border-white/5 opacity-50 cursor-default'
                            : isSelected
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const next = new Set(bulkSelectedFeeds);
                            if (e.target.checked) {
                              next.add(feed.feedUrl);
                            } else {
                              next.delete(feed.feedUrl);
                            }
                            setBulkSelectedFeeds(next);
                          }}
                          className="rounded border-gray-500 bg-white/10 text-green-500 focus:ring-green-500"
                        />
                        {feed.image && (
                          <img
                            src={feed.image}
                            alt={feed.title}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{feed.title}</p>
                          <p className="text-xs text-gray-400 truncate">{feed.author}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {feed.episodeCount > 0 && (
                            <span className="text-xs text-gray-500">{feed.episodeCount} tracks</span>
                          )}
                          {feed.alreadyExists && (
                            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">
                              exists
                            </span>
                          )}
                          {feed.isBlacklisted && (
                            <span className="px-2 py-0.5 bg-red-600/20 text-red-400 rounded text-xs">
                              blocked
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Import Button */}
                <button
                  onClick={importBulkFeeds}
                  disabled={bulkImporting || bulkSelectedFeeds.size === 0}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {bulkImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importing...
                    </>
                  ) : (
                    <>Import {bulkSelectedFeeds.size} Feed{bulkSelectedFeeds.size !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete by URL */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-red-500/30 p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-red-400">Delete Feed by URL</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="deleteUrl" className="block text-sm font-medium text-gray-300 mb-2">
                Paste Site URL (e.g., /album/some-album)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="deleteUrl"
                  value={deleteUrl}
                  onChange={(e) => {
                    setDeleteUrl(e.target.value);
                    setDeletePreview(null);
                  }}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData('text');
                    if (pastedText.trim()) {
                      e.preventDefault();
                      setDeleteUrl(pastedText.trim());
                      setDeletePreview(null);
                    }
                  }}
                  placeholder="http://localhost:3000/album/aseda or /album/aseda"
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={deletingByUrl}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={previewDeleteByUrl}
                  disabled={deletingByUrl || !deleteUrl.trim()}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                >
                  {deletingByUrl && !deletePreview ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Looking up...
                    </>
                  ) : (
                    <>
                      🔍 Preview
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Paste a site URL to look up the feed. Preview first to confirm, then delete.
              </p>
            </div>

            {/* Preview Result */}
            {deletePreview && (
              <div className={`rounded-lg p-4 border ${
                deletePreview.found
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-gray-500/10 border-gray-500/30'
              }`}>
                {deletePreview.found && deletePreview.feed ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-4">
                      {deletePreview.feed.image && (
                        <img
                          src={deletePreview.feed.image}
                          alt={deletePreview.feed.title}
                          className="w-16 h-16 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white">{deletePreview.feed.title}</h4>
                        <p className="text-sm text-gray-300">{deletePreview.feed.artist}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          📀 {deletePreview.feed.trackCount} tracks
                        </p>
                        <p className="text-xs text-gray-500 mt-1 font-mono">
                          ID: {deletePreview.feed.id}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={confirmDeleteByUrl}
                      disabled={deletingByUrl}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      {deletingByUrl ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          🗑️ Delete This Feed
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-gray-400">
                      {deletePreview.message || `No feed found for slug "${deletePreview.slug}"`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Database Cleanup - Orphaned Items */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-orange-500/30 p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-orange-400">Database Cleanup</h2>
          <p className="text-sm text-gray-400 mb-4">
            Remove feeds and tracks that are NOT referenced by any system playlist. This keeps only items that are part of curated playlists (MMM, SAS, HGH, etc.).
          </p>

          <div className="space-y-4">
            {/* Step 1: Parse missing tracks */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Step 1: Parse Missing Tracks</h3>
              <p className="text-xs text-gray-500 mb-3">
                Import tracks for feeds that have none. This ensures feeds are properly linked before cleanup.
              </p>
              <button
                type="button"
                onClick={parseMissingTracks}
                disabled={parsingMissingTracks || checkingOrphans || deletingOrphans}
                className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              >
                {parsingMissingTracks ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                    Parsing feeds...
                  </>
                ) : (
                  <>Parse Missing Tracks</>
                )}
              </button>
              {/* Progress Bar */}
              {parseProgress && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Processing {parseProgress.current} of {parseProgress.total}</span>
                    <span>{Math.round((parseProgress.current / parseProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(parseProgress.current / parseProgress.total) * 100}%` }}
                    />
                  </div>
                  {parseProgress.feedTitle && (
                    <p className="text-xs text-gray-500 truncate">
                      {parseProgress.feedTitle}
                    </p>
                  )}
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-400">{parseProgress.parsed} parsed</span>
                    <span className="text-yellow-400">{parseProgress.failed} failed</span>
                    <span className="text-blue-400">{parseProgress.totalTracks} tracks</span>
                  </div>
                </div>
              )}
              {parseResult && !parseProgress && (
                <div className="mt-3 text-xs text-gray-400">
                  Found {parseResult.total} feeds without tracks.
                  Parsed {parseResult.parsed}, imported {parseResult.totalTracks} tracks.
                  {parseResult.failed > 0 && <span className="text-yellow-400"> ({parseResult.failed} failed)</span>}
                </div>
              )}
              {failedFeeds.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowFailedFeeds(v => !v)}
                    className="text-xs text-gray-300 hover:text-white underline-offset-2 hover:underline"
                  >
                    {showFailedFeeds ? 'Hide' : 'Show'} per-feed log ({failedFeeds.length})
                  </button>
                  {showFailedFeeds && (
                    <div className="mt-2 max-h-64 overflow-y-auto rounded bg-black/30 border border-white/10 p-2 space-y-1 font-mono text-[11px]">
                      {(() => {
                        const counts = failedFeeds.reduce<Record<string, number>>((acc, f) => {
                          acc[f.reason] = (acc[f.reason] || 0) + 1;
                          return acc;
                        }, {});
                        return (
                          <div className="pb-2 mb-2 border-b border-white/10 text-gray-400">
                            {Object.entries(counts)
                              .sort(([, a], [, b]) => b - a)
                              .map(([reason, n]) => `${reason}: ${n}`)
                              .join(' · ')}
                          </div>
                        );
                      })()}
                      {failedFeeds.map((f, i) => (
                        <div
                          key={`${f.feedId}-${i}`}
                          className={f.severity === 'info' ? 'text-blue-300' : 'text-yellow-300'}
                        >
                          <span className="text-gray-500">[{f.reason}]</span>{' '}
                          <span>{f.feedId}</span>
                          {f.feedUrl && <span className="text-gray-500"> — {f.feedUrl}</span>}
                          {f.message && <span className="text-gray-400"> — {f.message}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Check for orphans */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Step 2: Check for Orphaned Items</h3>
              <p className="text-xs text-gray-500 mb-3">
                Find feeds/tracks not referenced by any system playlist.
              </p>
              <button
                type="button"
                onClick={checkForOrphans}
                disabled={checkingOrphans || deletingOrphans || parsingMissingTracks}
                className="px-4 py-2 bg-orange-600/20 text-orange-400 rounded-lg hover:bg-orange-600/30 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              >
                {checkingOrphans ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                    Checking...
                  </>
                ) : (
                  <>Check for Orphaned Items</>
                )}
              </button>
            </div>

            {/* Orphan Preview Results */}
            {orphanPreview && (
              <div className={`rounded-lg p-4 border ${
                orphanPreview.orphanedFeeds > 0
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-green-500/10 border-green-500/30'
              }`}>
                {orphanPreview.orphanedFeeds > 0 ? (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/5 rounded p-3">
                        <p className="text-xs text-gray-400">Feeds to Keep</p>
                        <p className="text-xl font-bold text-green-400">{orphanPreview.feedsToKeep}</p>
                      </div>
                      <div className="bg-white/5 rounded p-3">
                        <p className="text-xs text-gray-400">Orphaned Feeds</p>
                        <p className="text-xl font-bold text-red-400">{orphanPreview.orphanedFeeds}</p>
                      </div>
                      <div className="bg-white/5 rounded p-3">
                        <p className="text-xs text-gray-400">Orphaned Tracks</p>
                        <p className="text-xl font-bold text-red-400">{orphanPreview.orphanedTracks}</p>
                      </div>
                      <div className="bg-white/5 rounded p-3">
                        <p className="text-xs text-gray-400">Total in DB</p>
                        <p className="text-xl font-bold text-gray-300">{orphanPreview.totalFeeds} feeds</p>
                      </div>
                    </div>

                    {/* Sample Orphaned Feeds */}
                    {orphanPreview.sampleOrphanedFeeds.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-400 mb-2">
                          Sample of feeds to be deleted ({Math.min(50, orphanPreview.orphanedFeeds)} of {orphanPreview.orphanedFeeds}):
                        </p>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {orphanPreview.sampleOrphanedFeeds.map((feed) => (
                            <div key={feed.id} className="flex items-center gap-3 bg-white/5 rounded p-2 text-sm">
                              {feed.image && (
                                <img
                                  src={feed.image}
                                  alt={feed.title}
                                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-white truncate">{feed.title}</p>
                                <p className="text-xs text-gray-400">{feed.artist} - {feed.trackCount} tracks</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                feed.type === 'album' ? 'bg-blue-600/20 text-blue-400' :
                                feed.type === 'publisher' ? 'bg-purple-600/20 text-purple-400' :
                                'bg-gray-600/20 text-gray-400'
                              }`}>
                                {feed.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={deleteOrphanedItems}
                      disabled={deletingOrphans || checkingOrphans}
                      className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      {deletingOrphans ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Deleting...
                        </>
                      ) : (
                        <>Delete {orphanPreview.orphanedFeeds} Orphaned Feeds</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-green-400 font-medium">Database is clean!</p>
                    <p className="text-sm text-gray-400 mt-1">
                      All {orphanPreview.totalFeeds} feeds are referenced by system playlists.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recently Added Feeds */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Recently Added</h2>
            <button
              onClick={fetchRecentFeeds}
              disabled={loadingRecent}
              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loadingRecent ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loadingRecent && recentFeeds.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              Loading recent feeds...
            </div>
          ) : recentFeeds.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No feeds imported yet. Add your first feed above!
            </div>
          ) : (
            <div className="space-y-3">
              {recentFeeds.map((feed) => (
                <div
                  key={feed.id}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {feed.image && (
                      <img
                        src={feed.image}
                        alt={feed.title}
                        className="w-16 h-16 rounded object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={feed.type === 'publisher' ? `/publisher/${feed.id}` : `/album/${feed.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-white hover:text-blue-400 truncate block transition-colors"
                            title="View on site"
                          >
                            {feed.title} ↗
                          </a>
                          {feed.artist && (
                            <p className="text-sm text-gray-400">{feed.artist}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            feed.type === 'album' ? 'bg-blue-600/20 text-blue-400' :
                            feed.type === 'publisher' ? 'bg-purple-600/20 text-purple-400' :
                            'bg-green-600/20 text-green-400'
                          }`}>
                            {feed.type}
                          </span>
                          <button
                            onClick={() => reparseFeed(feed.id)}
                            disabled={reparsingFeeds.has(feed.id)}
                            className="px-3 py-1 bg-orange-600/20 text-orange-400 rounded hover:bg-orange-600/30 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Reparse feed from RSS source"
                          >
                            {reparsingFeeds.has(feed.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-orange-400"></div>
                                <span>Reparsing...</span>
                              </>
                            ) : (
                              <>
                                <span>🔄</span>
                                <span>Reparse</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>📀 {feed._count?.Track || 0} tracks</span>
                        {feed.v4vRecipient && (
                          <span className="text-green-400">⚡ {feed.v4vRecipient}</span>
                        )}
                        <span className="text-gray-500">
                          {new Date(feed.createdAt).toLocaleDateString()} {new Date(feed.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <a
                          href={feed.type === 'publisher' ? `/publisher/${feed.id}` : `/album/${feed.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 block transition-colors"
                        >
                          stablekraft.app/{feed.type === 'publisher' ? 'publisher' : 'album'}/{feed.id}
                        </a>
                        <a
                          href={feed.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 truncate block"
                        >
                          {feed.originalUrl}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Feeds Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h2 className="text-2xl font-semibold mb-4">Test Feeds</h2>
          <p className="text-gray-400 text-sm mb-4">
            These feeds are hidden from main site browsing and only accessible via direct links.
          </p>
          <div className="space-y-3">
            {/* LNURL Test Feed */}
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
              <a
                href="/album/lnurl-test-feed"
                className="flex-1 inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                LNURL Test Feed
              </a>
              <button
                onClick={async () => {
                  setReparsingFeeds(prev => new Set(prev).add('lnurl-test-feed'));
                  try {
                    const response = await fetch('/api/feeds/refresh-by-url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        url: 'https://raw.githubusercontent.com/ChadFarrow/lnurl-test-feed/main/public/lnurl-test-feed.xml',
                        feedId: 'lnurl-test-feed',
                        type: 'test'
                      })
                    });
                    const data = await response.json();
                    if (response.ok) {
                      toast.success(`LNURL Test Feed parsed! ${data.totalTracks || 0} tracks`);
                    } else {
                      toast.error(data.error || 'Failed to parse feed');
                    }
                  } catch (error) {
                    toast.error('Network error parsing feed');
                  } finally {
                    setReparsingFeeds(prev => {
                      const next = new Set(prev);
                      next.delete('lnurl-test-feed');
                      return next;
                    });
                  }
                }}
                disabled={reparsingFeeds.has('lnurl-test-feed')}
                className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reparsingFeeds.has('lnurl-test-feed') ? 'Parsing...' : 'Parse'}
              </button>
            </div>

            {/* Podtards Test Feed */}
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
              <a
                href="/publisher/podtards-test"
                className="flex-1 inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Podtards Test Feed
              </a>
              <button
                onClick={async () => {
                  setReparsingFeeds(prev => new Set(prev).add('podtards-test'));
                  try {
                    const response = await fetch('/api/feeds/refresh-by-url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        url: 'https://msp.podtards.com/api/hosted/3eeb8274-6e82-4f88-ad84-3416ea5c50c4.xml',
                        feedId: 'podtards-test'
                      })
                    });
                    const data = await response.json();
                    if (response.ok) {
                      toast.success(`Podtards Test Feed parsed! ${data.totalTracks || 0} tracks`);
                    } else {
                      toast.error(data.error || 'Failed to parse feed');
                    }
                  } catch (error) {
                    toast.error('Network error parsing feed');
                  } finally {
                    setReparsingFeeds(prev => {
                      const next = new Set(prev);
                      next.delete('podtards-test');
                      return next;
                    });
                  }
                }}
                disabled={reparsingFeeds.has('podtards-test')}
                className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reparsingFeeds.has('podtards-test') ? 'Parsing...' : 'Parse'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Import Result Modal */}
      {showImportResultModal && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl border border-white/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {importResult.success ? '✅ Import Successful!' : '⚠️ Import Completed with Warnings'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {importResult.success
                      ? 'Feed and tracks have been imported successfully'
                      : 'Feed was added but some issues were encountered'}
                  </p>
                </div>
                <button
                  onClick={() => setShowImportResultModal(false)}
                  className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Main Album/Feed Info */}
              <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                <div className="flex items-start gap-4">
                  {importResult.feed?.image && (
                    <img
                      src={importResult.feed.image}
                      alt={importResult.feed.title}
                      className="w-24 h-24 rounded-lg object-cover flex-shrink-0 shadow-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-2">
                      <h4 className="text-xl font-semibold text-white">{importResult.feed?.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                        importResult.feed?.type === 'album' ? 'bg-blue-600/20 text-blue-400' :
                        importResult.feed?.type === 'publisher' ? 'bg-purple-600/20 text-purple-400' :
                        'bg-green-600/20 text-green-400'
                      }`}>
                        {importResult.feed?.type}
                      </span>
                    </div>
                    {importResult.feed?.artist && (
                      <p className="text-gray-300 mb-3">{importResult.feed.artist}</p>
                    )}
                    <div className="space-y-2">
                      {importResult.linkedAlbums ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400">📀 Albums:</span>
                          <span className="text-white font-medium">{importResult.linkedAlbums.totalLinked} linked ({importResult.linkedAlbums.imported} imported, {importResult.linkedAlbums.remoteItemsFound} referenced)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400">📀 Tracks:</span>
                          <span className="text-white font-medium">{importResult.feed?._count?.Track || 0}</span>
                        </div>
                      )}
                      {importResult.feed?.v4vRecipient && (
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <span className="text-gray-400 flex-shrink-0">⚡ Lightning:</span>
                          <span className="text-green-400 font-mono text-xs truncate" title={importResult.feed.v4vRecipient}>{importResult.feed.v4vRecipient}</span>
                        </div>
                      )}
                      {importResult.feed?.v4vValue?.recipients && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">Payment splits:</p>
                          <div className="space-y-1">
                            {importResult.feed.v4vValue.recipients.map((recipient: any, idx: number) => (
                              <div key={idx} className="text-xs text-gray-300 font-mono break-all">
                                {recipient.name} ({recipient.split}%) - {recipient.address}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="pt-2 border-t border-white/10">
                        <a
                          href={importResult.feed?.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 truncate block"
                        >
                          {importResult.feed?.originalUrl}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Publisher Feed Auto-Import Info */}
              {importResult.importedPublisherFeed && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎤</div>
                    <div className="flex-1">
                      <h5 className="text-lg font-semibold text-purple-300 mb-2">
                        Publisher Feed Auto-Imported!
                      </h5>
                      <p className="text-sm text-gray-300 mb-3">
                        Found and automatically imported the artist's publisher feed:
                      </p>
                      <div className="bg-white/5 rounded p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{importResult.importedPublisherFeed.title}</span>
                          <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-xs font-medium">
                            publisher
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          📀 {importResult.importedPublisherFeed.trackCount} albums imported
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Publisher Feed Already Existed */}
              {importResult.publisherFeed?.found && importResult.publisherFeed?.alreadyImported && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-xl">ℹ️</div>
                    <div>
                      <p className="text-sm text-gray-300">
                        Publisher feed <span className="text-blue-300 font-medium">{importResult.publisherFeed.title}</span> was already in the database.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Publisher Feed Found but Not Auto-Imported */}
              {importResult.publisherFeed?.found &&
               !importResult.publisherFeed?.alreadyImported &&
               !importResult.publisherFeed?.autoImported &&
               !importResult.publisherFeed?.error && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-xl">🎤</div>
                    <div className="flex-1">
                      <p className="text-sm text-green-200 font-medium mb-2">
                        Publisher Feed Detected
                      </p>
                      <p className="text-sm text-gray-300 mb-2">
                        Found artist's publisher feed: <span className="text-green-300 font-medium">{importResult.publisherFeed.title}</span>
                      </p>
                      {importResult.publisherFeed.episodeCount && (
                        <p className="text-xs text-gray-400">
                          Contains {importResult.publisherFeed.episodeCount} albums
                        </p>
                      )}
                      <div className="mt-2 pt-2 border-t border-green-500/20">
                        <a
                          href={importResult.publisherFeed.feedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-400 hover:text-green-300"
                        >
                          {importResult.publisherFeed.feedUrl}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Publisher Auto-Import Failed */}
              {importResult.publisherFeed?.found && importResult.publisherFeed?.error && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-xl">⚠️</div>
                    <div>
                      <p className="text-sm text-yellow-200 font-medium mb-1">
                        Failed to auto-import publisher feed
                      </p>
                      <p className="text-xs text-gray-400">
                        {importResult.publisherFeed.error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning Message */}
              {importResult.warning && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-xl">⚠️</div>
                    <div>
                      <p className="text-sm text-orange-200">
                        Feed was added but parsing had some issues. Please check the feed details.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-white/10 p-6">
              <button
                onClick={() => setShowImportResultModal(false)}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 