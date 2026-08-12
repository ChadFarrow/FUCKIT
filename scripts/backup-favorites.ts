/**
 * Snapshot and restore a user's favorites.
 *
 *   npx tsx scripts/backup-favorites.ts dump    [<npub-or-hex>] > favorites.json
 *   npx tsx scripts/backup-favorites.ts restore favorites.json
 *
 * Against production:
 *   railway run --service StableKraft --environment production \
 *     npx tsx scripts/backup-favorites.ts dump > favorites-$(date +%F).json
 *
 * Why this exists: the cross-app favorites sync (docs/pc20-favorites.md) is the
 * only thing in this app that deletes favorite rows, and these rows are the
 * only copy — Boost Me Bitch can rebuild its whole list from the shared Nostr
 * event, a FavoriteTrack cannot. Deletion ships behind
 * SHARED_FAVORITES_APPLY_DELETES for that reason; take a snapshot before you
 * turn it on, and you have an actual restore path rather than a promise.
 *
 * `restore` is additive and idempotent: it re-creates missing rows and never
 * removes anything, so running it twice is harmless and running it against a
 * partially-recovered database does the right thing.
 */

import { readFileSync } from 'node:fs';
import { prisma } from '../lib/prisma';

interface Snapshot {
  takenAt: string;
  users: Array<{
    userId: string;
    nostrPubkey: string | null;
    albums: Array<{ feedId: string; type: string; nostrEventId: string | null; createdAt: string }>;
    tracks: Array<{ trackId: string; nostrEventId: string | null; createdAt: string }>;
  }>;
}

async function dump(who?: string) {
  const users = await prisma.user.findMany({
    where: who ? { OR: [{ id: who }, { nostrPubkey: who }, { nostrNpub: who }] } : undefined,
    select: { id: true, nostrPubkey: true },
  });
  if (users.length === 0) {
    console.error(who ? `No user matched "${who}"` : 'No users found');
    process.exit(1);
  }

  const snapshot: Snapshot = { takenAt: new Date().toISOString(), users: [] };
  for (const user of users) {
    const [albums, tracks] = await Promise.all([
      prisma.favoriteAlbum.findMany({
        where: { userId: user.id },
        select: { feedId: true, type: true, nostrEventId: true, createdAt: true },
      }),
      prisma.favoriteTrack.findMany({
        where: { userId: user.id },
        select: { trackId: true, nostrEventId: true, createdAt: true },
      }),
    ]);
    if (albums.length === 0 && tracks.length === 0) continue;
    snapshot.users.push({
      userId: user.id,
      nostrPubkey: user.nostrPubkey,
      albums: albums.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      tracks: tracks.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    });
  }

  // Counts to stderr so stdout stays a clean redirect target.
  for (const u of snapshot.users) {
    console.error(`  ${u.userId}: ${u.albums.length} albums, ${u.tracks.length} tracks`);
  }
  console.log(JSON.stringify(snapshot, null, 2));
}

async function restore(path: string) {
  const snapshot: Snapshot = JSON.parse(readFileSync(path, 'utf8'));
  console.error(`Restoring snapshot taken ${snapshot.takenAt}`);

  let albumsAdded = 0;
  let tracksAdded = 0;

  for (const user of snapshot.users) {
    for (const album of user.albums) {
      try {
        // createMany + skipDuplicates would be one query, but the unique index
        // is (userId, feedId) and a per-row create makes "already there" a
        // caught no-op rather than a silent skip we can't count.
        await prisma.favoriteAlbum.create({
          data: {
            userId: user.userId,
            feedId: album.feedId,
            type: album.type,
            nostrEventId: album.nostrEventId,
            createdAt: new Date(album.createdAt),
          },
        });
        albumsAdded += 1;
      } catch {
        /* already present */
      }
    }
    for (const track of user.tracks) {
      try {
        await prisma.favoriteTrack.create({
          data: {
            userId: user.userId,
            trackId: track.trackId,
            nostrEventId: track.nostrEventId,
            createdAt: new Date(track.createdAt),
          },
        });
        tracksAdded += 1;
      } catch {
        /* already present */
      }
    }
    console.error(`  ${user.userId}: restored ${albumsAdded} albums, ${tracksAdded} tracks so far`);
  }

  console.error(`Done. ${albumsAdded} album(s) and ${tracksAdded} track(s) re-created.`);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === 'dump') await dump(arg);
  else if (command === 'restore') {
    if (!arg) {
      console.error('restore needs a snapshot file: npx tsx scripts/backup-favorites.ts restore favorites.json');
      process.exit(1);
    }
    await restore(arg);
  } else {
    console.error('Usage: backup-favorites.ts dump [<npub-or-hex>] | restore <file.json>');
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
