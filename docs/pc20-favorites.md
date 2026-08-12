# Cross-app podcast favorites on Nostr

A user's favorites should follow them between podcast apps. This describes one
shared list on Nostr that any app can read and write, so favoriting a show in
one app makes it favorited in every other app the same person signs into.

Implemented by **Boost Me Bitch** and **StableKraft**. Nothing here is specific
to either — a third app needs only this document.

---

## The event

One [NIP-78](https://github.com/nostr-protocol/nips/blob/master/78.md)
application-data event per user, at a fixed, app-neutral address:

| | |
|---|---|
| `kind` | `30078` (NIP-78 application data) |
| `d` tag | `podcast:favorites` |
| `title` tag | `Podcast Favorites` — nothing renders it; it keeps the event self-describing |
| `content` | empty string, and **public** |

### It is a library, not a like

This list records **what a user has saved to listen to**, so their library follows
them between apps. It is deliberately *not* an endorsement, and an implementer
should not render it as one — no public like counts, no "N people saved this",
no feeding it into recommendations as a positive signal. People save things they
are unsure about and things they would not recommend.

If you want the public, social version — "I like this episode", countable, shown
to other people — that already exists and is a different event:
[NIP-25](https://github.com/nostr-protocol/nips/blob/master/25.md) **kind 17**
reactions, which carry the same NIP-73 `podcast:guid` / `podcast:item:guid`
identifiers and are what Fountain uses. Emit both if your app has both concepts.
Do not derive one from the other.

### On `content` being plaintext

This is a choice, not a constraint, and it is worth being explicit because the
obvious assumption is wrong in both directions.

**Encryption is available.** NIP-51-style private items are encrypted to the
user's *own* key, so any app holding their signer can decrypt them — a second
app reads them fine. "Other apps couldn't read it" is not a reason to skip
encryption.

**The actual costs are these.** A decrypt on every read: instant on a NIP-07
browser extension, but seconds or a phone tap on NIP-46/Amber, on every page
load unless you cache the plaintext against the event's `created_at`. And
nothing without a signer can read the list at all — no server-side resolution,
no debugging it from a relay query.

The reference implementations chose plaintext. **Say so in your UI**: the list is
public and signed by the user's key, so anyone can see what they have saved — the
same posture as a Nostr follow list. That is a disclosure even though it is not
an endorsement.

### Why not a NIP-51 bookmark set?

The obvious home is kind `30003`, and it's wrong. Kind 30003 is *user-named
bookmark collections* — saved links and articles. Two things follow, and both
are bad:

- **A generic Nostr client lists someone's podcast favorites among their
  bookmarks**, which is the wrong category. Podcasts aren't links you saved.
- **Any bookmark client that lets them edit a set will clobber this list**, and
  its author is doing nothing wrong. Kind 30003 is theirs to write, and they
  have no reason to implement the merge discipline below.

The second one is the real problem: it's silent data loss caused by a
well-behaved third party. Kind 30078 is app-defined data at a `d`-addressed
slot, so no generic client renders or rewrites it. That's exactly the property
this needs, and it's available today with no coordination.

A dedicated kind number would be cleaner still, but that needs the NIP process
and a number nobody else will use. Until there's a reason to spend that, 30078
is the home.

Items are [NIP-73](https://github.com/nostr-protocol/nips/blob/master/73.md)
external content identifiers, one `i` tag each:

```jsonc
{
  "kind": 30078,
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

An entry is unfavorited by being **absent from the next revision**. Kind 30078
is addressable/replaceable, so the newest event at this `d` wins outright.

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

Instead, each app keeps a **baseline**: the identifiers *it itself contributed*
as of its last sync, persisted locally per user. It publishes a *delta applied
to a fresh read*:

```
publish():
  latest, trustworthy = read()
  if not trustworthy: abort and retry later

  adds    = local    - baseline     # I added these
  removes = baseline - local        # I removed these
  next    = (latest - removes) ∪ adds

  write(next)
  baseline = next ∩ local           # MY contribution, not the whole list
```

Two details in there are easy to get wrong and both cost data:

- **`∪ adds`, not `∪ local`.** Appending your whole local set puts back
  anything another app removed while you still had it — the user unfavorites in
  app A, opens app B, and it returns. Only entries absent from your baseline are
  genuine local additions.
- **`baseline = next ∩ local`, not `baseline = next`.** `removes` is
  `baseline − local`, and `local` can only ever hold what your app can
  represent. A baseline holding the whole published list therefore turns every
  foreign identifier into one of your removals on the *next* publish — you delete
  another app's entries one toggle later. Store only what you contributed.

Which gives exactly the three properties the feature needs:

1. An entry another app added while you were offline is in `latest` but not in
   `baseline`, so it is never mistaken for one of your removals. It survives.
2. An entry *you* removed **is** in `baseline` and not in `local`, so it is
   deleted — unfavoriting propagates.
3. An empty local set with an empty baseline deletes nothing (a device that has
   not hydrated yet is not making a claim), while an empty local set with a full
   baseline is a real clear-all and is honoured.

**The same asymmetry governs reading.** If your app has its own store to
reconcile against the list — a database, not just a cache — delete a local
favorite only when it is in your baseline and absent from the list. Never
"everything I hold that isn't on the list": on the first run the list is empty
because nothing has published to it yet, and that rule reads an empty list as
"the user cleared everything" and wipes their library. An absent baseline means
you have never agreed to anything, so you may not delete at all.

Two cheap guards are worth having if your local store is the only copy of a
favorite. **Cap how much one reconcile may delete** — a mass removal is far more
likely to be a bug than a user action, and a real clear-all still applies once
the remaining set is under the cap. And **ship deletion behind a flag**, running
the reconcile in report-only mode first: you get to watch it be right before it
is allowed to be wrong. An app whose local list is a pure cache of the event
needs neither; an app with a database does.

### Never write on top of a read you didn't get

A relay query returning nothing has two meanings — "nobody has it" and "nothing
answered" — and only the first is data. Treating a timeout as an empty list and
publishing over it wipes the user's favorites across every app they own.

Distinguish them. Practically: an event in hand is proof the query worked;
otherwise only an aggregate EOSE counts, and resolving on a timeout means you
heard nothing. **If the read was degraded, publish nothing.** Losing a republish
is recoverable — the next toggle retries it — and the alternative is not.

### And say so

The guard above is silent by construction: it keeps local state, publishes
nothing, and returns. That is correct and it is not enough, because **a degraded
read and an empty list render identically**. On a device with no cache — a new
browser, a private tab, a second device — the result is a blank library with no
explanation, and "we couldn't reach the relays" is visually indistinguishable
from "your favorites are gone".

The failure mode is not the user's confusion, it's yours. When the reference
implementation hit this, production looked broken, the correct code was
suspected twice, and a revert of the safety guard was nearly shipped to fix a
bug that didn't exist. **The guard is most likely to be doubted on the exact
occasion it works.**

So: surface it. A non-blocking notice on the favorites surface — *"Couldn't
reach the relays — showing what's on this device"* — with a retry. Distinguish
the three states a favorites view otherwise collapses into one:

| | |
|---|---|
| **read failed** | say so, offer a retry, show the local copy if you have one |
| **read succeeded, list is empty** | your ordinary empty state |
| **not signed in** | never claim a relay failure — there is nothing to sync |

Two details worth copying. The write path is silent in the same way one screen
removed — a favorite toggled while the relays are unreachable skips its publish
and looks exactly like one that succeeded — so report both through **one** flag.
And a retry makes concurrent reads reachable for the first time, so make the
read single-flight; a double-tap must not run two read-merge-publish cycles.

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
4. **Record the baseline from your local set, not from the old list.** This is
   the step that looks like a detail and isn't.

Step 4 is worth spelling out, because "the entries I just moved across" is the
obvious definition of your contribution and it undoes the migration one line
later. The baseline is not a record of authorship — it is a promise that `local`
will keep asserting every id in it, since the next merge computes
`removes = baseline − local`. If your migration runs before those entries have
landed in the store you reconcile against (and it usually does — you migrate
early, you populate late), then a baseline naming the old ids makes your very
next merge read all of them as local removals and publish them straight back
out.

The symptom is a migration that reports success forever and never completes:
"migrated N entries" on every page load, N added and N deleted per load, and
nothing ever accumulating on the shared list. It is easy to miss precisely
because it is safe — the old event is untouched, so nothing is lost, and the
rollback path that protects you is also what hides the bug.

Leaving the migrated ids **out** of the baseline is the correct, conservative
answer: your merge then treats them as another app's entries and carries them
verbatim, which is what the format asks for anyway. They join your baseline on
a later pass, once they have resolved into your store and the promise can be
kept.

Run it on every hydration rather than once. It is a no-op after the first time,
and a user signing in on a second device months later still has their pre-sync
history waiting at the old address.

---

## Reference implementations

- **Boost Me Bitch** — `lib/nostr/favorites-merge.ts` (wire format + merge,
  deliberately import-free), `lib/nostr/favorites.ts` (I/O),
  `lib/nostr/favorites-hydrator.ts` (hydration + migration),
  `components/favorites-sync-notice.tsx` (the degraded-read notice). The merge
  is pinned by `npm run check:favsync`.
- **StableKraft** — `lib/nostr/shared-favorites.ts`, tested by
  `npx tsx --test lib/nostr/shared-favorites.test.ts`.

Both pin the same vectors. If you implement this, the ones worth copying are the
clobber case (a foreign entry surviving your republish), the two empty-local
cases, and the URL-shaped item guid.
