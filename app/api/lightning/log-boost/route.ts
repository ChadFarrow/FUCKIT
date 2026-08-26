import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter, clientIp } from '@/lib/rate-limit';
import { classifyBoostFailure } from '@/lib/lightning/boost-failure';
import { prisma } from '@/lib/prisma';
import type { BoostFailureScope } from '@/lib/admin/diagnostics';

/**
 * Classification plus its `[category user|fix]` log tag. Returned together because the
 * persisted row and the log line need the same verdict — classifying twice invites them
 * to disagree after a future edit to one call site.
 */
function classify(reason: string | null | undefined): { category: string; userActionable: boolean; tag: string } {
  const { category, userActionable } = classifyBoostFailure(reason);
  return { category, userActionable, tag: `[${category} ${userActionable ? 'user' : 'fix'}]` };
}

// This route is unauthenticated and unrate-limited by design one layer up (every real
// boost hits it, logged-out or not — see the client-log route's rationale), but unlike
// that route it used to write straight to Postgres with NO length clamp on any field.
// A 2,000,000-character `recipient` was accepted and stored verbatim. Every string below
// that reaches a persisted BoostFailure row gets clamped before it does, same discipline
// as `parseFailedRecipients` already applies to the failedRecipients array.
const MAX_RECIPIENT = 200;
const MAX_TITLE = 300;
const MAX_ARTIST = 200;
const MAX_FEED_ID = 200;
const MAX_TRACK_ID = 200;
const MAX_TYPE = 60;

// Same shape as the client-log route's limiter: in-memory, per Railway instance,
// with an opportunistic sweep so the map cannot leak across the instance's life.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const limiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
const isRateLimited = (ip: string) => limiter.isLimited(ip);

// One warning per process is enough to diagnose "the migration hasn't run" — without
// this, the window between deploying this code and running the BoostFailure migration
// makes every failed boost emit both Prisma's own error log and this one, up to 22
// times per request, burying the very lines this endpoint exists to make greppable.
let warnedBoostFailurePersistError = false;

/**
 * Records a failure for the /admin diagnostics panel.
 *
 * Never throws and never awaited into the response path: this route's job is to accept a
 * report, and a diagnostics write must not turn a boost into an error. A missing table —
 * the state between deploying this code and running the migration — lands here as a
 * caught error and simply collects nothing.
 */
async function persistBoostFailure(row: {
  category: string;
  userActionable: boolean;
  scope: BoostFailureScope;
  amount: number;
  recipient?: string;
  trackTitle?: string;
  artistName?: string;
  feedId?: string;
  trackId?: string;
  paymentType?: string;
  error: string;
}): Promise<void> {
  try {
    await prisma.boostFailure.create({ data: row });
  } catch (err) {
    if (!warnedBoostFailurePersistError) {
      console.warn('⚠️ Failed to persist boost failure (diagnostics only) — this warning will not repeat:', err);
      warnedBoostFailurePersistError = true;
    }
  }
}

// Simple in-memory storage for testing (replace with database in production)
const boostLog: Array<{
  id: string;
  trackId: string;
  feedId?: string;
  trackTitle?: string;
  artistName?: string;
  amount: number;
  message: string;
  type: string;
  recipient: string;
  preimage?: string;
  /** Whether the boost paid anyone at all. */
  status?: 'succeeded' | 'failed';
  error?: string;
  // Outcome of the 2 sat StableKraft fee, which is a separate LNURL payment made
  // after the recipients are paid. Reported by the client so a failure on a user's
  // machine is visible here instead of only in their browser console.
  feeStatus?: 'sent' | 'failed';
  feeError?: string;
  // Recipients that got nothing on a boost that still reported success — a split
  // payment counts as successful as soon as any one recipient is paid.
  failedRecipients?: Array<{ name: string; amount: number; error: string }>;
  timestamp: Date;
}> = [];

/**
 * Ring-buffer bound on the array above. It is process memory on a long-lived Railway
 * instance with nothing evicting it, and each entry can carry up to 20 failedRecipients
 * at ~700 chars each (~14KB) — so an uncapped array is a slow leak that got faster when
 * failures started being recorded alongside successes. The GET below reads the tail
 * anyway, so dropping the oldest costs nothing that is actually consulted.
 */
const MAX_BOOST_LOG = 500;

/**
 * Truncates a caller-supplied value for a persisted BoostFailure column, stripping NUL
 * bytes first — same fix as client-log's `clamp()`. A NUL makes the `create()` below
 * throw Postgres 22021 ("invalid byte sequence"), which is caught but only warns once
 * per process, so a single malformed request (e.g. `recipient: "a\0b"`) would otherwise
 * silence every later persist failure in this instance.
 */
function clampField(value: unknown, max: number): string {
  return String(value).replace(/\0/g, '').slice(0, max);
}

/** Client-reported, so shape-check it rather than trusting the body. */
function parseFailedRecipients(value: unknown): Array<{ name: string; amount: number; error: string }> | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const parsed = value.slice(0, 20).map((entry: any) => ({
    name: clampField(entry?.name ?? 'unknown', 200),
    amount: Number(entry?.amount) || 0,
    error: clampField(entry?.error ?? 'unknown error', 500),
  }));

  return parsed.length > 0 ? parsed : undefined;
}

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(clientIp(req.headers))) {
      return new NextResponse(null, { status: 429 });
    }

    const body = await req.json();

    // Access fields directly from body to avoid destructuring issues
    const trackId = body.trackId;
    const feedId = body.feedId;
    const trackTitle = body.trackTitle;
    const artistName = body.artistName;
    // Defensive coercion: a caller-supplied non-numeric or negative amount used to
    // flow straight into a persisted Int column.
    const amount = Math.max(0, Math.floor(Number(body.amount) || 0));
    const message = body.message;
    const type = body.type;
    const recipient = body.recipient;
    const preimage = body.preimage;
    const status: 'succeeded' | 'failed' = body.status === 'failed' ? 'failed' : 'succeeded';
    const error = typeof body.error === 'string' ? body.error.slice(0, 500) : undefined;
    const feeStatus = body.feeStatus === 'failed' || body.feeStatus === 'sent' ? body.feeStatus : undefined;
    const feeError = typeof body.feeError === 'string' ? body.feeError.slice(0, 500) : undefined;
    const failedRecipients = parseFailedRecipients(body.failedRecipients);

    // Check which required fields are missing
    const missingFields = [];
    if (!trackId || typeof trackId !== 'string' || trackId.trim().length === 0) missingFields.push('trackId');
    if (!amount || amount <= 0) missingFields.push('amount');
    if (!type || typeof type !== 'string' || type.trim().length === 0) missingFields.push('type');
    if (!recipient || typeof recipient !== 'string' || recipient.trim().length === 0) missingFields.push('recipient');
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return NextResponse.json({
        error: `Missing required fields: ${missingFields.join(', ')}`,
        received: body
      }, { status: 400 });
    }

    // Clamped copies for the persisted BoostFailure rows only — the in-memory
    // ring-buffer `boost` entry below and its log lines keep the original values,
    // unchanged from before this fix.
    const safeRecipient = clampField(recipient, MAX_RECIPIENT);
    const safeTrackTitle = trackTitle !== undefined ? clampField(trackTitle, MAX_TITLE) : undefined;
    const safeArtistName = artistName !== undefined ? clampField(artistName, MAX_ARTIST) : undefined;
    const safeFeedId = feedId !== undefined ? clampField(feedId, MAX_FEED_ID) : undefined;
    const safeTrackId = clampField(trackId, MAX_TRACK_ID);
    const safeType = clampField(type, MAX_TYPE);

    const boost = {
      id: `boost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      trackId,
      feedId,
      trackTitle,
      artistName,
      amount,
      message: message || '',
      type,
      recipient,
      preimage,
      status,
      error,
      feeStatus,
      feeError,
      failedRecipients,
      timestamp: new Date(),
    };

    boostLog.push(boost);
    if (boostLog.length > MAX_BOOST_LOG) {
      boostLog.splice(0, boostLog.length - MAX_BOOST_LOG);
    }

    console.log(`⚡ Boost logged (${status}):`, boost.id);

    // Logged at error severity so these surface in Railway without trawling the feed.
    if (status === 'failed') {
      const verdict = classify(error);
      console.error(
        `❌ ${verdict.tag} Boost failed entirely — ${amount} sats to ${recipient}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${type}):` +
        ` ${error || 'no reason reported'}`
      );
      // Fire-and-forget: persistBoostFailure catches internally, so this can't surface as
      // an unhandled rejection, and not awaiting it keeps a slow/hanging DB off the response.
      void persistBoostFailure({
        category: verdict.category,
        userActionable: verdict.userActionable,
        scope: 'boost',
        amount,
        recipient: safeRecipient,
        trackTitle: safeTrackTitle,
        artistName: safeArtistName,
        feedId: safeFeedId,
        trackId: safeTrackId,
        paymentType: safeType,
        error: error || 'no reason reported',
      });
    }

    if (failedRecipients) {
      // Classify each recipient once — reused for both the log line and its persisted row,
      // so a future edit to one call site can't make the tag and the stored category disagree.
      const recipientVerdicts = failedRecipients.map(r => ({ r, verdict: classify(r.error) }));
      console.error(
        `❌ ${failedRecipients.length} recipient(s) unpaid on boost ${boost.id}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${amount} sats, ${type}): ` +
        recipientVerdicts.map(({ r, verdict }) => `${verdict.tag} ${r.name} (${r.amount} sats): ${r.error}`).join(' | ')
      );
      // One row per unpaid recipient — which recipient failed is the whole point. This loop
      // is fired as ONE detached task that awaits each write sequentially (not fanned out
      // concurrently), so it alone never holds more than one connection-pool slot at a time
      // instead of up to 20 at once. It is one of three independent detached paths on this
      // route, though (this loop, the boost-level persistBoostFailure above, and the fee-level
      // one below) — if all three fire on the same request, up to three concurrent writes can
      // be in flight against the pool (lib/prisma.ts caps it at 3 outside development). Still
      // fire-and-forget overall — the response does not wait on any of them.
      void (async () => {
        for (const { r, verdict } of recipientVerdicts) {
          await persistBoostFailure({
            category: verdict.category,
            userActionable: verdict.userActionable,
            scope: 'recipient',
            amount: r.amount,
            recipient: r.name,
            trackTitle: safeTrackTitle,
            artistName: safeArtistName,
            feedId: safeFeedId,
            trackId: safeTrackId,
            paymentType: safeType,
            error: r.error,
          });
        }
      })();
    }

    if (feeStatus === 'failed') {
      const verdict = classify(feeError);
      console.error(
        `❌ ${verdict.tag} StableKraft fee failed on boost ${boost.id} — ${amount} sats to ${recipient}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${type}):` +
        ` ${feeError || 'no reason reported'}`
      );
      void persistBoostFailure({
        category: verdict.category,
        userActionable: verdict.userActionable,
        scope: 'fee',
        amount,
        recipient: safeRecipient,
        trackTitle: safeTrackTitle,
        artistName: safeArtistName,
        feedId: safeFeedId,
        trackId: safeTrackId,
        paymentType: safeType,
        error: feeError || 'no reason reported',
      });
    }

    return NextResponse.json({
      success: true,
      boostId: boost.id,
      message: 'Boost logged successfully',
    });
  } catch (error) {
    console.error('Error logging boost:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log boost',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const trackId = searchParams.get('trackId');

    let filteredBoosts = boostLog;

    if (trackId) {
      filteredBoosts = boostLog.filter(boost => boost.trackId === trackId);
    }

    // Sort by timestamp (newest first) and limit results
    const sortedBoosts = filteredBoosts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    const totalAmount = sortedBoosts.reduce((sum, boost) => sum + boost.amount, 0);

    return NextResponse.json({
      success: true,
      boosts: sortedBoosts,
      totalAmount,
      count: sortedBoosts.length,
    });
  } catch (error) {
    console.error('Error fetching boosts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch boosts',
      },
      { status: 500 }
    );
  }
}
