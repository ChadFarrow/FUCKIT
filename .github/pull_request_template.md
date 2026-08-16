<!--
Write prose, not a form. The best PRs in this repo (#213, #214, #216, #217) lead with what was
actually wrong and why it was invisible, then show measured evidence. Delete any heading you
don't need — an empty section is worse than no section.
-->

## What was wrong

<!-- The defect or gap, and why it wasn't obvious. If a guard existed and didn't fire, say what it
matched instead. Numbers beat adjectives: "matched 0 of 176 real recipients" (#217). -->

## What changed

<!-- The shape of the fix, and why this shape rather than a smaller one. -->

## Verification

<!-- What you RAN, with results. Not "tested locally". CI runs the first three on every PR. -->

- [ ] `npm run typecheck`
- [ ] `npm run test:all` — _N_ passing
- [ ] `npx next lint` — no new warnings
- [ ] `npm run build` (stop `npm run dev` first — both write `.next/`)

<!-- Then the evidence specific to this change. Some traps that have burned us:

  * Favorites — verify against the RELAY and the DATABASE, never the UI. The heart clearing, the
    row being gone, and the entry leaving the list are three different facts, and they have
    disagreed three times in a row. `npx tsx lib/nostr/favorites.relay-probe.ts` + `railway run`,
    and compare `createdAt` before believing anything changed.
  * Layout — measure all four edges with puppeteer-core against the real component. Several bugs
    survived a sweep that only checked one edge.
  * A grep that returns nothing is not evidence. Quote the globs, check the exit status.
-->

## Before merging

<!-- Delete what doesn't apply. These are not generic hygiene — each one has caused a production
     bug or a silent data loss in this repo. -->

- [ ] **Migration?** Railway does NOT run migrations on deploy. Run
      `railway run --service StableKraft --environment production npm run db:migrate` **before**
      the code reading the new column goes live, or every query selecting it 500s (issue #122).
- [ ] **Changed what `/api/albums-fast` returns?** Bump `API_VERSION` in `app/page.tsx` (currently
      `v16`), or clients keep serving stale data out of localStorage indefinitely. Not just for
      shape changes — `v16` was a value correction with an unchanged shape.
- [ ] **New/changed field?** The same field is usually written from N places, and fixing one is
      the standard bug here. `grep -rn "prisma.<model>.create\|upsert"` — and check the **re-key**
      paths (`refresh-by-url` deletes a row and rebuilds it field by field, so an omitted column
      is dropped, not merely unset).
- [ ] **Touched `Feed.type` or `Feed.medium`?** They are not interchangeable. `type` is our
      classification and is often a guess; `medium` is what the feed declared and nothing may
      default it. Only `medium` may go on the cross-app favorites list.
- [ ] **New `NEXT_PUBLIC_*`?** It bakes in at build time — set it before the deploy that needs it.
- [ ] **Route fetches a caller-supplied URL?** `isSafePublicUrl()` returns `{ ok, ... }`, not a
      boolean. `if (!isSafePublicUrl(u))` negates an object, is always false, silently makes the
      SSRF guard dead code, and `tsc --noEmit` stays clean.
- [ ] **Route learns who is calling?** Only via `requireUser(request)`. `grep -rn
      "x-nostr-user-id" app/api` must stay empty.
- [ ] **Native Android change?** A web deploy does not update the APK — it needs a new build and
      a `versionCode` bump.

<!-- `git push origin main` IS the production deploy. There is no preview environment. -->

## Deliberately not in scope

<!-- Optional, and one of the more useful sections here — it stops a reviewer flagging a known
gap as an oversight. See #216's note on inbound removals. -->

## Open questions

<!-- Optional. Anything unverified, or a manual step someone must do before or after merge —
e.g. #217 couldn't reach fountain.fm from its sandbox and said so. -->
