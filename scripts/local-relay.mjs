#!/usr/bin/env node
/**
 * A NIP-01 relay on 127.0.0.1, in memory, for testing the favorites sync.
 *
 * WHY THIS EXISTS: this repo has no preview environment. `git push origin main`
 * IS the production deploy, and a dev server on localhost publishes to the real
 * default relays under the user's real npub. There is no dry-run mode and a
 * replaceable event keeps no history, so a bad publish while testing is not
 * recoverable. Everything about the cross-app favorites list has to be provable
 * before it is pushed, and this is where it gets proved.
 *
 * REPLACEABLE-EVENT SEMANTICS ARE THE POINT. kind:10333 is one event per
 * pubkey, and the whole subsystem — the carry, the merge, the digest gate,
 * idempotence — is about what happens when it is rewritten. A relay that
 * appended would make every one of those look like it worked.
 *
 * Deliberately NOT implemented, because nothing under test uses them: AUTH
 * (NIP-42), event deletion (NIP-09 kind 5), NIP-11 relay info, and any
 * persistence. Restarting the process empties it, which is usually what you
 * want between cases.
 *
 * Usage:
 *   npm run relay                 # ws://127.0.0.1:7777
 *   PORT=8888 npm run relay
 */

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 7777);

/**
 * Every event this relay holds, newest first is NOT guaranteed — filters sort
 * at query time. Replaceable kinds are collapsed on insert instead, so the
 * store never holds two events that a real relay would have collapsed.
 */
const events = [];

/** Regular replaceable: exactly one per (kind, pubkey). Includes kind 10333. */
const isReplaceable = (kind) => kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);

/** Addressable: one per (kind, pubkey, d-tag). Includes the 30078/34139 events. */
const isAddressable = (kind) => kind >= 30000 && kind < 40000;

const dTagOf = (event) => event.tags.find((t) => t[0] === 'd')?.[1] ?? '';

/**
 * Insert, collapsing whatever a real relay would collapse.
 *
 * The `created_at` comparison is what makes a republish observable: an event
 * older than the one held is REJECTED rather than stored, so a test that
 * forgets to advance the timestamp fails here instead of silently passing.
 */
function store(event) {
  const replaces = isReplaceable(event.kind)
    ? (e) => e.kind === event.kind && e.pubkey === event.pubkey
    : isAddressable(event.kind)
      ? (e) => e.kind === event.kind && e.pubkey === event.pubkey && dTagOf(e) === dTagOf(event)
      : null;

  if (!replaces) {
    if (events.some((e) => e.id === event.id)) return { ok: true, message: 'duplicate:' };
    events.push(event);
    return { ok: true, message: '' };
  }

  const existing = events.findIndex(replaces);
  if (existing === -1) {
    events.push(event);
    return { ok: true, message: '' };
  }
  // Ties go to the event already held, per NIP-01: same timestamp, lowest id
  // wins. Getting this backwards makes a no-op republish look like a change.
  const held = events[existing];
  if (event.created_at < held.created_at) return { ok: false, message: 'invalid: older than stored' };
  if (event.created_at === held.created_at && event.id >= held.id) {
    return { ok: true, message: 'duplicate:' };
  }
  events[existing] = event;
  return { ok: true, message: '' };
}

/** NIP-01 filter matching, limited to what the favorites code actually sends. */
function matches(event, filter) {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.since && event.created_at < filter.since) return false;
  if (filter.until && event.created_at > filter.until) return false;

  // Tag filters: "#i", "#d", "#p"… each value list is an OR, and separate keys AND.
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(values)) continue;
    const name = key.slice(1);
    const present = event.tags.some((t) => t[0] === name && values.includes(t[1]));
    if (!present) return false;
  }
  return true;
}

function query(filters) {
  const seen = new Set();
  const out = [];
  for (const filter of filters) {
    const hits = events
      .filter((e) => matches(e, filter))
      .sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1));
    for (const e of filter.limit ? hits.slice(0, filter.limit) : hits) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });

wss.on('connection', (ws) => {
  /** Live subscriptions, so a publish reaches a reader that is still listening. */
  const subs = new Map();

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify(['NOTICE', 'invalid json']));
      return;
    }
    if (!Array.isArray(msg)) return;
    const [type] = msg;

    if (type === 'EVENT') {
      const event = msg[1];
      if (!event?.id || !event?.pubkey || typeof event.kind !== 'number') {
        ws.send(JSON.stringify(['OK', event?.id ?? '', false, 'invalid: malformed event']));
        return;
      }
      const { ok, message } = store(event);
      ws.send(JSON.stringify(['OK', event.id, ok, message]));
      if (!ok) return;
      // Fan out to everyone still subscribed, this socket included.
      for (const client of wss.clients) {
        const live = client === ws ? subs : client.__subs;
        if (!live) continue;
        for (const [subId, filters] of live) {
          if (filters.some((f) => matches(event, f))) {
            client.send(JSON.stringify(['EVENT', subId, event]));
          }
        }
      }
      return;
    }

    if (type === 'REQ') {
      const [, subId, ...filters] = msg;
      subs.set(subId, filters);
      ws.__subs = subs;
      for (const event of query(filters)) {
        ws.send(JSON.stringify(['EVENT', subId, event]));
      }
      // A REAL EOSE. `relay-read.ts` treats a synthesized one as an unanswered
      // read, so a relay that skipped this would make every read degraded.
      ws.send(JSON.stringify(['EOSE', subId]));
      return;
    }

    if (type === 'CLOSE') {
      subs.delete(msg[1]);
      return;
    }
  });

  ws.on('close', () => subs.clear());
});

wss.on('listening', () => {
  console.log(`local relay: ws://127.0.0.1:${PORT}`);
  console.log('point the app at it with NEXT_PUBLIC_NOSTR_RELAYS=ws://127.0.0.1:' + PORT);
});

const shutdown = () => {
  console.log(`\nlocal relay: closing, held ${events.length} event(s)`);
  wss.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
