'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { toast } from '@/components/Toast';

/**
 * Boost failures and client errors on /admin.
 *
 * Its own component rather than two more cards inside AdminPanel.tsx, which is already
 * ~2,900 lines and ten cards. Owns its own fetch and state.
 */

interface BoostFailureRow {
  id: string;
  createdAt: string;
  category: string;
  userActionable: boolean;
  scope: string;
  amount: number;
  recipient: string | null;
  trackTitle: string | null;
  artistName: string | null;
  error: string;
}

interface ClientErrorRow {
  id: string;
  day: string;
  level: string;
  category: string;
  message: string;
  count: number;
  lastSeen: string;
  samplePath: string | null;
  samplePlatform: string | null;
  sampleData: string | null;
}

interface DiagnosticsResponse {
  since: string;
  days: number;
  boostFailures: {
    summary: Array<{ category: string; userActionable: boolean; count: number }>;
    recent: BoostFailureRow[];
  };
  clientErrors: {
    summary: Array<{ category: string; count: number }>;
    recent: ClientErrorRow[];
  };
}

const CARD = 'bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6';
const BTN = 'px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors text-sm font-medium disabled:opacity-50';

export default function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (rangeDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/diagnostics?days=${rangeDays}`);
      if (!res.ok) {
        setError('Failed to load diagnostics');
        toast.error('Failed to load diagnostics');
        return;
      }
      setData(await res.json());
    } catch {
      setError('Failed to load diagnostics');
      toast.error('Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const rangePicker = (
    <div className="flex items-center gap-2">
      <select
        value={days}
        onChange={e => setDays(Number(e.target.value))}
        className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-white/10"
      >
        <option value={1}>Last 24h</option>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
      </select>
      <button onClick={() => load(days)} disabled={loading} className={BTN}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  );

  const boost = data?.boostFailures;
  const errors = data?.clientErrors;

  return (
    <>
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Boost Failures</h2>
          {rangePicker}
        </div>

        {boost && boost.summary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {boost.summary.map(s => (
              <span key={s.category} className="px-2 py-1 rounded-lg text-xs bg-white/5 border border-white/10">
                <span className="font-mono">{s.category}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded ${s.userActionable ? 'bg-yellow-600/20 text-yellow-400' : 'bg-red-600/20 text-red-400'}`}>
                  {s.userActionable ? 'user' : 'fix'}
                </span>
                <span className="ml-2 text-gray-400">×{s.count}</span>
              </span>
            ))}
          </div>
        )}

        {!data && !error ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : !data && error ? (
          <div className="flex items-center gap-2">
            <p className="text-red-400 text-sm">Couldn&apos;t load diagnostics.</p>
            <button onClick={() => load(days)} disabled={loading} className={BTN}>Retry</button>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-yellow-500 text-xs mb-2">Refresh failed — showing last loaded data, which may be out of date.</p>
            )}
            {boost && boost.recent.length === 0 ? (
              <p className="text-gray-400 text-sm">No boost failures in the last {data?.days} day(s).</p>
            ) : (
              <div className="space-y-2">
                {boost?.recent.map(row => (
                  <div key={row.id} className="text-sm border-b border-white/5 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-500 font-mono text-xs">{new Date(row.createdAt).toLocaleString()}</span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5">{row.scope}</span>
                      <span className={row.userActionable ? 'text-yellow-400' : 'text-red-400'}>{row.category}</span>
                      <span className="text-gray-300">{row.amount} sats → {row.recipient || 'unknown'}</span>
                    </div>
                    <div className="text-gray-400 text-xs mt-0.5">
                      {row.trackTitle || 'unknown track'} / {row.artistName || 'unknown artist'} — {row.error}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className={CARD}>
        {/* No rangePicker here — the one on the Boost Failures card above drives both
            cards (see `days` state), so this header has only the one child. */}
        <div className="flex items-center mb-4">
          <h2 className="text-2xl font-semibold">Client Errors</h2>
        </div>

        {errors && errors.summary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {errors.summary.map(s => (
              <span key={s.category} className="px-2 py-1 rounded-lg text-xs bg-white/5 border border-white/10">
                <span className="font-mono">{s.category}</span>
                <span className="ml-2 text-gray-400">×{s.count}</span>
              </span>
            ))}
          </div>
        )}

        {!data && !error ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : !data && error ? (
          <div className="flex items-center gap-2">
            <p className="text-red-400 text-sm">Couldn&apos;t load diagnostics.</p>
            <button onClick={() => load(days)} disabled={loading} className={BTN}>Retry</button>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-yellow-500 text-xs mb-2">Refresh failed — showing last loaded data, which may be out of date.</p>
            )}
            {errors && errors.recent.length === 0 ? (
              // "day(s)" here are UTC calendar-day buckets, not exact hours — a "1 day"
              // range can cover up to 48h (see the route's comment on the asymmetry with
              // Boost Failures' exact-instant filter). Worded to not overclaim precision.
              <p className="text-gray-400 text-sm">No client errors in the last {data?.days} calendar day(s) (UTC).</p>
            ) : (
              <div className="space-y-2">
                {errors?.recent.map(row => (
                  <div key={row.id} className="text-sm border-b border-white/5 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={row.level === 'error' ? 'text-red-400' : 'text-yellow-400'}>{row.level}</span>
                      <span className="font-mono text-xs text-gray-400">{row.category}</span>
                      <span className="text-gray-200">{row.message}</span>
                      <span className="text-gray-500">×{row.count}</span>
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {row.day} · last seen {new Date(row.lastSeen).toLocaleString()} · {row.samplePath || 'unknown path'} · {row.samplePlatform || 'unknown platform'}
                    </div>
                    {row.sampleData && (
                      <div className="text-gray-600 text-xs mt-0.5 font-mono truncate" title={row.sampleData}>
                        {row.sampleData.slice(0, 200)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
