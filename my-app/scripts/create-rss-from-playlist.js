#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';

const RSS_FEED_URL = 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';

async function createRSSFromPlaylist() {
  try {
    console.log('📡 Creating RSS feed from Doerfel-Verse music playlist...\n');
    
    // Fetch and parse original RSS feed
    const response = await fetch(RSS_FEED_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Get original feed metadata
    const channel = xmlDoc.getElementsByTagName('channel')[0];
    const originalTitle = channel.getElementsByTagName('title')[0]?.textContent;
    const originalDescription = channel.getElementsByTagName('description')[0]?.textContent;
    const originalLink = channel.getElementsByTagName('link')[0]?.textContent;
    const originalLanguage = channel.getElementsByTagName('language')[0]?.textContent || 'en';
    const originalImage = channel.getElementsByTagName('image')[0];
    
    // Create new RSS feed
    const rssFeed = {
      title: "Doerfel-Verse Music Playlist",
      description: "Music playlist RSS feed created from podcast:remoteItem references in Into The Doerfel-Verse podcast",
      link: "https://www.doerfelverse.com/",
      language: originalLanguage,
      lastBuildDate: new Date().toUTCString(),
      generator: "Doerfel-Verse Music Playlist Generator",
      episodes: []
    };
    
    // Extract episodes with remote items
    const episodes = xmlDoc.getElementsByTagName('item');
    
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      const title = episode.getElementsByTagName('title')[0]?.textContent;
      const pubDate = episode.getElementsByTagName('pubDate')[0]?.textContent;
      const guid = episode.getElementsByTagName('guid')[0]?.textContent;
      const description = episode.getElementsByTagName('description')[0]?.textContent;
      const link = episode.getElementsByTagName('link')[0]?.textContent;
      const duration = episode.getElementsByTagName('itunes:duration')[0]?.textContent;
      const enclosure = episode.getElementsByTagName('enclosure')[0];
      
      // Find remote items within this episode
      const episodeRemoteItems = episode.getElementsByTagName('podcast:remoteItem');
      
      if (episodeRemoteItems.length > 0) {
                 const episodeData = {
           title: `${title} (Music Playlist)`,
           pubDate: pubDate,
           guid: `${guid}-music-playlist`,
           description: createMusicDescription(description, episodeRemoteItems),
           link: link,
           duration: duration,
           enclosure: enclosure ? {
             url: enclosure.getAttribute('url'),
             type: enclosure.getAttribute('type'),
             length: enclosure.getAttribute('length')
           } : null,
           remoteItems: []
         };
        
        for (let j = 0; j < episodeRemoteItems.length; j++) {
          const remoteItem = episodeRemoteItems[j];
          const feedGuid = remoteItem.getAttribute('feedGuid');
          const itemGuid = remoteItem.getAttribute('itemGuid');
          const feedUrl = remoteItem.getAttribute('feedUrl');
          
          episodeData.remoteItems.push({
            feedGuid,
            itemGuid,
            feedUrl,
            type: itemGuid ? 'specific_episode' : 'entire_feed'
          });
        }
        
        rssFeed.episodes.push(episodeData);
      }
    }
    
    // Generate RSS XML
    const rssXML = generateRSSXML(rssFeed, originalImage);
    
    // Save RSS feed
    const outputDir = path.join(process.cwd(), 'playlists');
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(
      path.join(outputDir, 'doerfel-verse-music-playlist.xml'),
      rssXML
    );
    
    // Also save a JSON version for reference
    await fs.writeFile(
      path.join(outputDir, 'doerfel-verse-music-playlist-rss.json'),
      JSON.stringify(rssFeed, null, 2)
    );
    
    console.log('✅ RSS feed created successfully!');
    console.log(`📁 Files saved to: ${outputDir}/`);
    console.log(`📊 Summary:`);
    console.log(`  - Episodes in RSS feed: ${rssFeed.episodes.length}`);
    console.log(`  - Total remote items: ${rssFeed.episodes.reduce((sum, ep) => sum + ep.remoteItems.length, 0)}`);
    console.log(`  - RSS feed URL: ${outputDir}/doerfel-verse-music-playlist.xml`);
    
    // Show sample episodes
    console.log(`\n🎵 Sample episodes in RSS feed:`);
    rssFeed.episodes.slice(0, 3).forEach((episode, index) => {
      console.log(`  ${index + 1}. ${episode.title}`);
      console.log(`     Published: ${episode.pubDate}`);
      console.log(`     Music items: ${episode.remoteItems.length}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function createMusicDescription(originalDescription, remoteItems) {
  let description = `<p><strong>🎵 Music Playlist Episode</strong></p>\n`;
  description += `<p>${originalDescription}</p>\n`;
  description += `<p><strong>Referenced Music:</strong></p>\n<ul>\n`;
  
  for (let i = 0; i < remoteItems.length; i++) {
    const item = remoteItems[i];
    const feedGuid = item.getAttribute('feedGuid');
    const itemGuid = item.getAttribute('itemGuid');
    const feedUrl = item.getAttribute('feedUrl');
    
    description += `<li>Feed: ${feedGuid}`;
    if (itemGuid) {
      description += `, Item: ${itemGuid}`;
    }
    if (feedUrl) {
      description += `, <a href="${feedUrl}">Listen</a>`;
    }
    description += `</li>\n`;
  }
  
  description += `</ul>\n`;
  description += `<p><em>Generated from podcast:remoteItem references using Podcast Index namespace</em></p>`;
  
  return description;
}

function generateRSSXML(rssFeed, originalImage) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">\n';
  xml += '<channel>\n';
  
  // Channel metadata
  xml += `  <title>${escapeXML(rssFeed.title)}</title>\n`;
  xml += `  <description>${escapeXML(rssFeed.description)}</description>\n`;
  xml += `  <link>${escapeXML(rssFeed.link)}</link>\n`;
  xml += `  <language>${escapeXML(rssFeed.language)}</language>\n`;
  xml += `  <lastBuildDate>${escapeXML(rssFeed.lastBuildDate)}</lastBuildDate>\n`;
  xml += `  <generator>${escapeXML(rssFeed.generator)}</generator>\n`;
  
  // Add podcast namespace medium tag
  xml += '  <podcast:medium>music</podcast:medium>\n';
  
  // Add original image if available
  if (originalImage) {
    const imageUrl = originalImage.getElementsByTagName('url')[0]?.textContent;
    const imageTitle = originalImage.getElementsByTagName('title')[0]?.textContent;
    if (imageUrl) {
      xml += '  <image>\n';
      xml += `    <url>${escapeXML(imageUrl)}</url>\n`;
      if (imageTitle) {
        xml += `    <title>${escapeXML(imageTitle)}</title>\n`;
      }
      xml += '  </image>\n';
    }
  }
  
  // Add episodes
  rssFeed.episodes.forEach(episode => {
    xml += '  <item>\n';
    xml += `    <title>${escapeXML(episode.title)}</title>\n`;
    xml += `    <description>${escapeXML(episode.description)}</description>\n`;
    xml += `    <pubDate>${escapeXML(episode.pubDate)}</pubDate>\n`;
    xml += `    <guid>${escapeXML(episode.guid)}</guid>\n`;
    if (episode.link) {
      xml += `    <link>${escapeXML(episode.link)}</link>\n`;
    }
    if (episode.duration) {
      xml += `    <itunes:duration>${escapeXML(episode.duration)}</itunes:duration>\n`;
    }
    
    // Add remote items as podcast:remoteItem elements
    episode.remoteItems.forEach(remoteItem => {
      xml += '    <podcast:remoteItem';
      xml += ` feedGuid="${escapeXML(remoteItem.feedGuid)}"`;
      if (remoteItem.itemGuid) {
        xml += ` itemGuid="${escapeXML(remoteItem.itemGuid)}"`;
      }
      if (remoteItem.feedUrl) {
        xml += ` feedUrl="${escapeXML(remoteItem.feedUrl)}"`;
      }
      xml += ' />\n';
    });
    
         // Add original enclosure if available
     if (episode.enclosure && episode.enclosure.url) {
       xml += '    <enclosure';
       xml += ` url="${escapeXML(episode.enclosure.url)}"`;
       if (episode.enclosure.type) xml += ` type="${escapeXML(episode.enclosure.type)}"`;
       if (episode.enclosure.length) xml += ` length="${escapeXML(episode.enclosure.length)}"`;
       xml += ' />\n';
     }
    
    xml += '  </item>\n';
  });
  
  xml += '</channel>\n';
  xml += '</rss>';
  
  return xml;
}

function escapeXML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Run the script
createRSSFromPlaylist(); 