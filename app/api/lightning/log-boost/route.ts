import { NextRequest, NextResponse } from 'next/server';

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
  // Outcome of the 2 sat StableKraft fee, which is a separate LNURL payment made
  // after the recipients are paid. Reported by the client so a failure on a user's
  // machine is visible here instead of only in their browser console.
  // Whether the boost paid anyone at all.
  status?: 'succeeded' | 'failed';
  error?: string;
  feeStatus?: 'sent' | 'failed';
  feeError?: string;
  // Recipients that got nothing on a boost that still reported success — a split
  // payment counts as successful as soon as any one recipient is paid.
  failedRecipients?: Array<{ name: string; amount: number; error: string }>;
  timestamp: Date;
}> = [];

/** Client-reported, so shape-check it rather than trusting the body. */
function parseFailedRecipients(value: unknown): Array<{ name: string; amount: number; error: string }> | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const parsed = value.slice(0, 20).map((entry: any) => ({
    name: String(entry?.name ?? 'unknown').slice(0, 200),
    amount: Number(entry?.amount) || 0,
    error: String(entry?.error ?? 'unknown error').slice(0, 500),
  }));

  return parsed.length > 0 ? parsed : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Access fields directly from body to avoid destructuring issues
    const trackId = body.trackId;
    const feedId = body.feedId;
    const trackTitle = body.trackTitle;
    const artistName = body.artistName;
    const amount = body.amount;
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

    console.log(`⚡ Boost logged (${status}):`, boost.id);

    // Logged at error severity so these surface in Railway without trawling the feed.
    if (status === 'failed') {
      console.error(
        `❌ Boost failed entirely — ${amount} sats to ${recipient}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${type}):` +
        ` ${error || 'no reason reported'}`
      );
    }

    if (failedRecipients) {
      console.error(
        `❌ ${failedRecipients.length} recipient(s) unpaid on boost ${boost.id}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${amount} sats, ${type}): ` +
        failedRecipients.map(r => `${r.name} (${r.amount} sats): ${r.error}`).join(' | ')
      );
    }

    if (feeStatus === 'failed') {
      console.error(
        `❌ StableKraft fee failed on boost ${boost.id} — ${amount} sats to ${recipient}` +
        ` (${trackTitle || 'unknown track'} / ${artistName || 'unknown artist'}, ${type}):` +
        ` ${feeError || 'no reason reported'}`
      );
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
