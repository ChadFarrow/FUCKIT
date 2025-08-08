#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';

/**
 * Parse a Podcasting 2.0 music playlist RSS feed and emit a concise JSON summary.
 *
 * Usage:
 *   node scripts/parse-itdv-music-feed.js <feedUrl> [--out <outputPath>]
 */

function parseCliArgs(argv) {
  const args = { feedUrl: undefined, out: undefined };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--out') {
      args.out = argv[++i];
    } else if (!args.feedUrl) {
      args.feedUrl = token;
    }
  }
  return args;
}

function getTextContent(parent, tagName) {
  const el = parent?.getElementsByTagName(tagName)?.[0];
  return el?.textContent ?? null;
}

function getFirstElement(parent, tagName) {
  return parent?.getElementsByTagName(tagName)?.[0] ?? null;
}

async function parseFeed(feedUrl) {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed. HTTP ${response.status}`);
  }
  const xmlText = await response.text();

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Validate parsing
  const parseErrors = xmlDoc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    throw new Error('XML parsing failed');
  }

  const channel = getFirstElement(xmlDoc, 'channel');
  if (!channel) throw new Error('No <channel> element found');

  const image = getFirstElement(channel, 'image');
  const channelSummary = {
    title: getTextContent(channel, 'title'),
    description: getTextContent(channel, 'description'),
    link: getTextContent(channel, 'link'),
    language: getTextContent(channel, 'language'),
    lastBuildDate: getTextContent(channel, 'lastBuildDate'),
    generator: getTextContent(channel, 'generator'),
    image: image ? {
      url: getTextContent(image, 'url'),
      title: getTextContent(image, 'title'),
    } : null,
  };

  const items = channel.getElementsByTagName('item');
  const episodes = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const enclosure = getFirstElement(item, 'enclosure');
    const remoteItems = item.getElementsByTagName('podcast:remoteItem');

    const episode = {
      title: getTextContent(item, 'title'),
      pubDate: getTextContent(item, 'pubDate'),
      guid: getTextContent(item, 'guid'),
      link: getTextContent(item, 'link'),
      description: getTextContent(item, 'description'),
      duration: getTextContent(item, 'itunes:duration'),
      enclosure: enclosure ? {
        url: enclosure.getAttribute('url'),
        type: enclosure.getAttribute('type'),
        length: enclosure.getAttribute('length'),
      } : null,
      remoteItems: [],
    };

    for (let j = 0; j < remoteItems.length; j++) {
      const ri = remoteItems[j];
      episode.remoteItems.push({
        feedGuid: ri.getAttribute('feedGuid') || null,
        itemGuid: ri.getAttribute('itemGuid') || null,
        feedUrl: ri.getAttribute('feedUrl') || null,
      });
    }

    episodes.push(episode);
  }

  return { channel: channelSummary, episodes };
}

async function main() {
  try {
    const { feedUrl, out } = parseCliArgs(process.argv);
    if (!feedUrl) {
      console.error('Usage: node scripts/parse-itdv-music-feed.js <feedUrl> [--out <outputPath>]');
      process.exit(2);
    }

    console.log(`🔍 Fetching feed: ${feedUrl}`);
    const summary = await parseFeed(feedUrl);

    // Default output path
    const outputPath = out
      ? out
      : path.join(process.cwd(), 'playlists', 'itdv-music-feed-summary.json');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf-8');

    const totalRemoteItems = summary.episodes.reduce((acc, e) => acc + e.remoteItems.length, 0);

    console.log('✅ Parsed successfully');
    console.log(`📁 Saved JSON: ${outputPath}`);
    console.log('📊 Stats:');
    console.log(`  - Episodes: ${summary.episodes.length}`);
    console.log(`  - Total remote items: ${totalRemoteItems}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

await main();


