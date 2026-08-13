# Cross-app podcast favorites on Nostr

This spec lives at its own canonical, app-neutral home — not inside either
participating app's repo, so there's one copy to link to instead of several
that can silently drift apart:

**→ [github.com/ChadFarrow/PC20-Nostr/blob/main/pc20-favorites.md](https://github.com/ChadFarrow/PC20-Nostr/blob/main/pc20-favorites.md)**

One plain replaceable event at **kind 10333**, `i` tags grouped under a running
`medium`, no `d` tag, no baseline, no merge. Republishing the whole tag list is
the sync.

It supersedes the two-list NIP-78 kind:30078 design, which proved
overcomplicated in practice and has since been deleted from that repo along
with the rest of the old layout. StableKraft implemented it and no longer does;
the events it published are still on the relays and are the rollback path, but
nothing here reads or writes them.

Implemented here in:

- `lib/nostr/pc20-identifiers.ts` — the NIP-73 identifier vocabulary, which
  outlives any one event format
- `lib/nostr/favorites-single-list.ts` — the format: build, parse, fetch
- `lib/nostr/relay-read.ts` — the trusted replaceable-event read
- `lib/nostr/favorites-sync-client.ts` — DB→identifier mapping, debounce,
  publish, pull, sync health
- `app/api/favorites/sync-shared/route.ts` — inbound reconcile

```
npx tsx --test lib/nostr/favorites-single-list.test.ts   # the format
npx tsx --test lib/nostr/relay-read.test.ts              # the read, vs scripted relays
npx tsx lib/nostr/favorites.relay-probe.ts               # live smoke check (network)
```

Read the linked doc, not this stub, for the format itself.
