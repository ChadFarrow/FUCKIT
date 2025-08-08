#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { DOMParser } from '@xmldom/xmldom';

const PODCASTINDEX_BASE = 'https://api.podcastindex.org/api/1.0';

function getEnv(name) {
  return process.env[name] ?? '';
}

function sha1Hex(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

function buildPiHeaders() {
  const apiKey = getEnv('PODCASTINDEX_API_KEY');
  const apiSecret = getEnv('PODCASTINDEX_API_SECRET');
  if (!apiKey || !apiSecret) return null;
  const ts = Math.floor(Date.now() / 1000);
  const authHash = sha1Hex(apiKey + apiSecret + ts);
  return {
    'X-Auth-Date': String(ts),
    'X-Auth-Key': apiKey,
    'Authorization': authHash,
    'User-Agent': 'itdv-feed-resolver/1.0',
    'Accept': 'application/json'
  };
}

async function piGet(pathname, params) {
  const headers = buildPiHeaders();
  if (!headers) return null;
  const url = new URL(PODCASTINDEX_BASE + pathname);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;
  return res.json();
}

async function fetchPageTitle(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (match) return match[1].trim();
  } catch {
    // ignore
  }
  return null;
}

async function main() {
  // Load env from .env.local at project root
  dotenv.config({ path: path.join(process.cwd(), '.env.local') });
  const summaryPath = path.join(process.cwd(), 'playlists', 'itdv-music-feed-summary.json');
  const raw = await fs.readFile(summaryPath, 'utf-8');
  const summary = JSON.parse(raw);

  const feedCache = new Map();
  const episodeCache = new Map();
  const episodesByFeedIdCache = new Map(); // feedId(number) -> Map(itemGuid -> episode)

  const results = [];
  const rssCache = new Map(); // feedUrl -> { byGuid: Map, meta }

  for (const ep of summary.episodes) {
    for (const ri of ep.remoteItems || []) {
      const feedGuid = ri.feedGuid || '';
      const itemGuid = ri.itemGuid || '';

      let feedTitle = null;
      let feedUrl = null;
      let episodeTitle = null;
      let episodeEnclosureUrl = null;

      // Resolve feed info via PodcastIndex if possible
      if (feedGuid) {
        if (!feedCache.has(feedGuid)) {
          const data = await piGet('/podcasts/byguid', { guid: feedGuid });
          const info = data && data.feed ? {
            id: data.feed.id ?? null,
            title: data.feed.title || null,
            url: data.feed.url || data.feed.link || null,
          } : { id: null, title: null, url: null };
          feedCache.set(feedGuid, info);
        }
        const fc = feedCache.get(feedGuid);
        const feedId = fc.id;
        feedTitle = fc.title;
        feedUrl = fc.url;
      }

      // Resolve episode info via PodcastIndex if possible
      if (itemGuid) {
        if (!episodeCache.has(itemGuid)) {
          let info = { title: null, enclosureUrl: null };
          const data = await piGet('/episodes/byguid', { guid: itemGuid });
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            const item = data.items[0];
            info = {
              title: item.title || null,
              enclosureUrl: item.enclosureUrl || null,
            };
          } else if (/^https?:\/\//i.test(itemGuid)) {
            const t = await fetchPageTitle(itemGuid);
            info = { title: t, enclosureUrl: null };
          }
          episodeCache.set(itemGuid, info);
        }
        const ec = episodeCache.get(itemGuid);
        episodeTitle = ec.title;
        episodeEnclosureUrl = ec.enclosureUrl;
      }

      // If still unresolved and we have a feed URL, fetch RSS and match by <guid>
      if ((!episodeTitle || !episodeEnclosureUrl) && feedUrl && itemGuid) {
        // Load RSS for this feedUrl into cache once
        if (!rssCache.has(feedUrl)) {
          try {
            const res = await fetch(feedUrl, { redirect: 'follow' });
            if (res.ok) {
              const xml = await res.text();
              const parser = new DOMParser();
              const doc = parser.parseFromString(xml, 'text/xml');
              const items = doc.getElementsByTagName('item');
              const byGuid = new Map();
              for (let i = 0; i < items.length; i++) {
                const it = items[i];
                const guidEl = it.getElementsByTagName('guid')?.[0];
                const titleEl = it.getElementsByTagName('title')?.[0];
                const enclosureEl = it.getElementsByTagName('enclosure')?.[0];
                const guidText = guidEl?.textContent?.trim();
                const titleText = titleEl?.textContent?.trim() || null;
                const enclosureUrl = enclosureEl?.getAttribute('url') || null;
                if (guidText) {
                  byGuid.set(guidText, { title: titleText, enclosureUrl });
                }
              }
              rssCache.set(feedUrl, { byGuid });
            } else {
              rssCache.set(feedUrl, { byGuid: new Map() });
            }
          } catch {
            rssCache.set(feedUrl, { byGuid: new Map() });
          }
        }
        const cache = rssCache.get(feedUrl);
        const matched = cache.byGuid.get(itemGuid) || cache.byGuid.get(String(itemGuid).trim());
        if (matched) {
          if (!episodeTitle) episodeTitle = matched.title;
          if (!episodeEnclosureUrl) episodeEnclosureUrl = matched.enclosureUrl;
        }
      }

      // If still unresolved and we have feedId, use PodcastIndex by-feedid endpoint to list episodes and match by guid
      if ((!episodeTitle || !episodeEnclosureUrl) && feedGuid && itemGuid) {
        const fc = feedCache.get(feedGuid);
        const feedId = fc?.id;
        if (feedId) {
          if (!episodesByFeedIdCache.has(feedId)) {
            const map = new Map();
            const data = await piGet('/episodes/byfeedid', { id: feedId, max: 1000 });
            if (data && Array.isArray(data.items)) {
              for (const item of data.items) {
                const epGuid = (item.guid || '').trim();
                if (epGuid) {
                  map.set(epGuid, item);
                }
              }
            }
            episodesByFeedIdCache.set(feedId, map);
          }
          const byGuid = episodesByFeedIdCache.get(feedId);
          const ep = byGuid.get(String(itemGuid).trim());
          if (ep) {
            if (!episodeTitle) episodeTitle = ep.title || null;
            if (!episodeEnclosureUrl) episodeEnclosureUrl = ep.enclosureUrl || null;
          }
        }
      }

      results.push({
        feedGuid,
        itemGuid,
        feedTitle,
        feedUrl,
        episodeTitle,
        episodeEnclosureUrl,
      });
    }
  }

  // Write outputs
  const outDir = path.join(process.cwd(), 'playlists');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'itdv-music-feed-resolved.json'), JSON.stringify(results, null, 2));

  const csvHeader = 'feedGuid,itemGuid,feedTitle,episodeTitle,feedUrl,episodeEnclosureUrl';
  const csvRows = results.map(r => [r.feedGuid, r.itemGuid, r.feedTitle || '', r.episodeTitle || '', r.feedUrl || '', r.episodeEnclosureUrl || '']
    .map(v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(','));
  await fs.writeFile(path.join(outDir, 'itdv-music-feed-resolved.csv'), [csvHeader, ...csvRows].join('\n'));

  // Print concise output to console
  for (const r of results) {
    const left = r.feedGuid + ',' + r.itemGuid;
    const right = r.episodeTitle || '(unresolved)';
    process.stdout.write(`${left} => ${right}\n`);
  }
}

await main();


