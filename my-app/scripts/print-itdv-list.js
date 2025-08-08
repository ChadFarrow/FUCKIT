#!/usr/bin/env node

import fs from 'fs/promises';

async function main() {
  const summaryPath = new URL('../playlists/itdv-music-feed-summary.json', import.meta.url);
  const raw = await fs.readFile(summaryPath, 'utf-8');
  const data = JSON.parse(raw);
  const lines = [];
  for (const ep of data.episodes) {
    for (const ri of ep.remoteItems || []) {
      const feedGuid = ri.feedGuid ?? '';
      const itemGuid = ri.itemGuid ?? '';
      lines.push(`${feedGuid},${itemGuid}`);
    }
  }
  process.stdout.write(lines.join('\n'));
}

await main();


