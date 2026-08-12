# Cross-app podcast favorites on Nostr

A user's favorites should follow them between podcast apps. This describes one
shared list on Nostr that any app can read and write, so favoriting a show in
one app makes it favorited in every other app the same person signs into.

Implemented by **Boost Me Bitch** and **StableKraft**. Nothing here is specific
to either — a third app needs only this document.

---

## The event

One [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md) bookmark
set per user, at a fixed, app-neutral address:

| | |
|---|---|
| `kind` | `30003` (NIP-51 bookmark set) |
| `d` tag | `podcast:favorites` |
| `title` tag | `Podcast Favorites` |
| `content` | empty string |

Items are [NIP-73](https://github.com/nostr-protocol/nips/blob/master/73.md)
external content identifiers, one `i` tag each:

```jsonc
{
  "kind": 30003,
  "tags": [
    ["d", "podcast:favorites"],
    ["title", "Podcast Favorites"],

    // a podcast / album — Podcasting 2.0 <podcast:guid>
    ["i", "podcast:guid:917393e3-1b1e-5cef-ace4-edaa54e1f810", "https://example.com/feed.xml"],

    // an episode / track — the RSS item's <guid>
    ["i", "podcast:item:guid:https://example.com/ep/42",
          "https://example.com/feed.xml",
          "podcast:guid:917393e3-1b1e-5cef-ace4-edaa54e1f810"],

    ["k", "podcast:guid"],
    ["k", "podcast:item:guid"]
  ],
  "content": ""
}
```

### Tag positions

- **Position 1** — the NIP-73 identifier. This is the merge key; nothing else
  identifies an entry.
- **Position 2** — NIP-73's optional URL hint. Use the **feed's RSS URL**. It
  lets an app resolve an entry without a Podcast Index key.
- **Position 3** — *extension*: `podcast:guid:<feedGuid>` of an item's parent
  feed. Podcast Index's `/episodes/byguid` wants `podcastguid`, so an item guid
  on its own is not a reliable lookup. When position 3 is present but position 2
  is unknown, hold position 2 open with an empty string rather than shifting.

  This is additive and safe to ignore: an app that reads only positions 1–2 sees
  an ordinary, well-formed NIP-73 tag. Writers **should** emit it.

- `k` tags: one per **distinct** identifier kind present, not one per favorite.
  Recognized kinds are `podcast:guid`, `podcast:item:guid` and
  `podcast:publisher:guid`. Derive the kind from that table — *not* by scanning
  for a colon, since item guids are routinely permalink URLs and
  `podcast:item:guid:https://…` would yield `podcast:item:guid:https`.

### Removal

An entry is unfavorited by being **absent from the next revision**. Kind 30003
is a replaceable event, so the newest one wins outright.

Do **not** publish NIP-09 kind-5 deletions for favorites. They are unnecessary
here and, applied to a shared list, would remove entries belonging to other
apps.

---

## The merge — read this part twice

The list is **one replaceable event with many writers**. There is no partial
update: every publish replaces the whole thing. So a naive writer destroys other
apps' data, and there is no error, no undo, and no sign of it on the device that
did it.

Two obvious approaches are both wrong:

- **Publish your local set.** Erases every entry added by another app.
- **Publish the union of local and remote.** Never removes anything, so
  unfavoriting silently stops working — forever, on every device.

Instead, each app keeps a **baseline**: the identifier list it last agreed with
the relay on, persisted locally per user. It publishes a *delta applied to a
fresh read*:

```
publish():
  latest, trustworthy = read()
  if not trustworthy: abort and retry later

  adds    = local      - baseline     # I added these
  removes = baseline   - local        # I removed these
  next    = (latest ∪ adds) - removes

  write(next)
  baseline = next
```

Which gives exactly the three properties the feature needs:

1. An entry another app added while you were offline is in `latest` but not in
   `baseline`, so it is never mistaken for one of your removals. It survives.
2. An entry *you* removed **is** in `baseline` and not in `local`, so it is
   deleted — unfavoriting propagates.
3. An empty local set with an empty baseline deletes nothing (a device that has
   not hydrated yet is not making a claim), while an empty local set with a full
   baseline is a real clear-all and is honoured.

### Never write on top of a read you didn't get

A relay query returning nothing has two meanings — "nobody has it" and "nothing
answered" — and only the first is data. Treating a timeout as an empty list and
publishing over it wipes the user's favorites across every app they own.

Distinguish them. Practically: an event in hand is proof the query worked;
otherwise only an aggregate EOSE counts, and resolving on a timeout means you
heard nothing. **If the read was degraded, publish nothing.** Losing a republish
is recoverable — the next toggle retries it — and the alternative is not.

### Carry what you can't read

The merge operates on **raw identifier strings**. Never interpret an entry
before merging, and never drop one for being unrecognized:

- A music app has no UI for `podcast:item:guid:` entries a podcast app added.
- A podcast app has no UI for `podcast:publisher:guid:`.
- Neither knows what a third app will add next.

Preserve unknown `i` tags verbatim, hints and all. Preserve unrecognized
top-level tags too, and preserve `k` tags naming kinds you don't generate —
stripping those removes another app's `#k` discovery filter from the event.

"My app can't display this" and "this is junk" are different claims, and only
the user gets to make the second one. If an app offers a cleanup for malformed
entries, it must be an explicit user action, never automatic.

---

## Resolving an entry

Given a `podcast:guid:<uuid>`:

1. Look it up locally, if you have a catalogue.
2. Podcast Index: `GET /api/1.0/podcasts/byguid?guid=<uuid>`.
3. Fall back to the position-2 URL hint — fetch the feed, or
   `GET /api/1.0/podcasts/byfeedurl?url=<hint>`.

Given a `podcast:item:guid:<guid>`:

1. Look it up locally by item guid.
2. Podcast Index:
   `GET /api/1.0/episodes/byguid?guid=<guid>&podcastguid=<feedGuid from position 3>`.
3. Fall back to the position-2 feed URL and search its items.

Resolution is a fan-out over the whole list, so **probe first, then batch**: one
sequential request, and if it fails with a 5xx, skip the rest rather than
opening one socket per favorite against an endpoint that is already down. Cache
results; a returning user hydrates on every page load.

### What can't be represented

An entry needs a globally-unique identifier. A favorite keyed only on an
app-local database id, or on a feed with no `<podcast:guid>`, cannot go on the
list. Skip it — and, symmetrically, **never delete it during reconciliation**:
something that could never have appeared on the list cannot be missing from it.

---

## Publishing notes

- **Debounce.** Collapse rapid toggles into one read-merge-publish cycle, and so
  one signing prompt. ~0.5–1.5 s works well. One republish per window, not one
  per item — the whole point of a list event.
- **Verify the publish landed.** Some relay clients resolve with per-relay
  results and never reject; an unchecked `await` can't tell "stored" from
  "refused by every relay". Assert at least one success.
- **Connect before you publish** if your relay client requires it. A client that
  iterates only connected relays publishes to nobody, successfully, if you skip
  that step.
- **Relays.** The user's NIP-65 write relays unioned with your defaults. Always
  include the defaults: a dead or AUTH-gated relay in a user's list otherwise
  produces "published to 0 relays".

---

## Migrating an existing list

An app that already had its own favorites list can adopt this one without losing
anything:

1. Read both the old address and `podcast:favorites`.
2. **Only if both reads are trustworthy**, merge the old entries in with an
   *empty baseline* — a migration only ever adds, and passing the old ids as a
   baseline would read anything already on the shared list as a removal.
3. Publish the shared list. Leave the old event in place; it costs nothing and
   is the rollback path.

Run it on every hydration rather than once. It is a no-op after the first time,
and a user signing in on a second device months later still has their pre-sync
history waiting at the old address.

---

## Reference implementations

- **Boost Me Bitch** — `lib/nostr/favorites-merge.ts` (wire format + merge,
  deliberately import-free), `lib/nostr/favorites.ts` (I/O),
  `lib/nostr/favorites-hydrator.ts` (hydration + migration). The merge is pinned
  by `npm run check:favsync`.
- **StableKraft** — `lib/nostr/shared-favorites.ts`, tested by
  `npx tsx --test lib/nostr/shared-favorites.test.ts`.

Both pin the same vectors. If you implement this, the ones worth copying are the
clobber case (a foreign entry surviving your republish), the two empty-local
cases, and the URL-shaped item guid.
