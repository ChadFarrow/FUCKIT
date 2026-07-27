/**
 * Fire-and-forget boost reporter for the auto-boost paths.
 *
 * Auto-boost fires during playback, which is exactly when nobody is looking at the
 * screen — the phone is locked, the app is backgrounded, the toast lands on a
 * display that is off. So a toast is not a report, and until this existed the
 * auto-boost paths POSTed on success only: a boost that failed mid-album left no
 * trace anywhere except a console nobody would ever open.
 *
 * Never throws and never blocks playback — a reporting failure must not surface as
 * an audio bug. Callers may `void` it.
 */

export interface BoostReport {
  /** Falls back like BoostButton's own chain — the log route rejects an empty one,
   *  and a report dropped on a 400 defeats the point of reporting at all. */
  trackId?: string;
  feedId?: string;
  trackTitle?: string;
  artistName?: string;
  amount: number;
  senderName?: string;
  preimage?: string;
  /** Falls back to 'unknown' — the log route rejects an empty recipient outright. */
  recipient?: string;
  status?: 'succeeded' | 'failed';
  error?: string;
  /** Recipients that got nothing on a boost that otherwise counted as successful. */
  failedRecipients?: Array<{ name: string; amount: number; error: string }>;
  /** 'auto' for both the track-end and VTS-chapter paths. */
  type?: string;
}

export async function reportBoost(report: BoostReport): Promise<void> {
  try {
    await fetch('/api/lightning/log-boost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '',
        ...report,
        trackId: report.trackId || report.trackTitle || 'auto-boost',
        type: report.type || 'auto',
        recipient: report.recipient || 'unknown',
        status: report.status || 'succeeded',
      }),
    });
  } catch (error) {
    console.warn('⚠️ Failed to report boost:', error);
  }
}
