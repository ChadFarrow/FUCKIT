#!/usr/bin/env node

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';

const RSS_FEED_URL = 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';

async function createMusicPlaylist() {
  try {
    console.log('🎵 Creating music playlist from Doerfel-Verse podcast:remoteItem elements...\n');
    
    // Fetch and parse RSS feed
    const response = await fetch(RSS_FEED_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Find all podcast:remoteItem elements
    const remoteItems = xmlDoc.getElementsByTagName('podcast:remoteItem');
    console.log(`📊 Found ${remoteItems.length} remote items to process\n`);
    
    // Extract episodes and their remote items
    const episodes = xmlDoc.getElementsByTagName('item');
    const playlist = {
      title: "Doerfel-Verse Music Playlist",
      description: "Music playlist created from podcast:remoteItem references in Into The Doerfel-Verse podcast",
      source: RSS_FEED_URL,
      created: new Date().toISOString(),
      episodes: []
    };
    
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      const title = episode.getElementsByTagName('title')[0]?.textContent;
      const pubDate = episode.getElementsByTagName('pubDate')[0]?.textContent;
      const guid = episode.getElementsByTagName('guid')[0]?.textContent;
      const description = episode.getElementsByTagName('description')[0]?.textContent;
      
      // Find remote items within this episode
      const episodeRemoteItems = episode.getElementsByTagName('podcast:remoteItem');
      
      if (episodeRemoteItems.length > 0) {
        const episodeData = {
          episodeTitle: title,
          published: pubDate,
          guid: guid,
          description: description,
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
        
        playlist.episodes.push(episodeData);
      }
    }
    
    // Create different playlist formats
    const playlists = {
      json: playlist,
      m3u: createM3UPlaylist(playlist),
      txt: createTextPlaylist(playlist),
      csv: createCSVPlaylist(playlist)
    };
    
    // Save playlists to files
    const outputDir = path.join(process.cwd(), 'playlists');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save JSON playlist
    await fs.writeFile(
      path.join(outputDir, 'doerfel-verse-playlist.json'),
      JSON.stringify(playlists.json, null, 2)
    );
    
    // Save M3U playlist
    await fs.writeFile(
      path.join(outputDir, 'doerfel-verse-playlist.m3u'),
      playlists.m3u
    );
    
    // Save text playlist
    await fs.writeFile(
      path.join(outputDir, 'doerfel-verse-playlist.txt'),
      playlists.txt
    );
    
    // Save CSV playlist
    await fs.writeFile(
      path.join(outputDir, 'doerfel-verse-playlist.csv'),
      playlists.csv
    );
    
    // Display summary
    console.log('✅ Playlist created successfully!');
    console.log(`📁 Files saved to: ${outputDir}/`);
    console.log(`📊 Summary:`);
    console.log(`  - Episodes with music references: ${playlist.episodes.length}`);
    console.log(`  - Total remote items: ${remoteItems.length}`);
    console.log(`  - Average items per episode: ${(remoteItems.length / playlist.episodes.length).toFixed(1)}`);
    
    // Show top episodes by remote item count
    console.log(`\n🎵 Top episodes by music references:`);
    playlist.episodes
      .sort((a, b) => b.remoteItems.length - a.remoteItems.length)
      .slice(0, 5)
      .forEach((episode, index) => {
        console.log(`  ${index + 1}. ${episode.episodeTitle} (${episode.remoteItems.length} items)`);
      });
    
    // Show most referenced feeds
    const feedCounts = {};
    playlist.episodes.forEach(episode => {
      episode.remoteItems.forEach(item => {
        feedCounts[item.feedGuid] = (feedCounts[item.feedGuid] || 0) + 1;
      });
    });
    
    console.log(`\n🎵 Most referenced music feeds:`);
    Object.entries(feedCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([feedGuid, count], index) => {
        console.log(`  ${index + 1}. ${feedGuid} (${count} references)`);
      });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function createM3UPlaylist(playlist) {
  let m3u = '#EXTM3U\n';
  m3u += `# ${playlist.title}\n`;
  m3u += `# ${playlist.description}\n`;
  m3u += `# Created: ${playlist.created}\n\n`;
  
  playlist.episodes.forEach(episode => {
    m3u += `# ${episode.episodeTitle}\n`;
    episode.remoteItems.forEach(item => {
      if (item.feedUrl) {
        m3u += `${item.feedUrl}\n`;
      } else {
        m3u += `# Feed: ${item.feedGuid}, Item: ${item.itemGuid}\n`;
      }
    });
    m3u += '\n';
  });
  
  return m3u;
}

function createTextPlaylist(playlist) {
  let text = `${playlist.title}\n`;
  text += `${playlist.description}\n`;
  text += `Created: ${playlist.created}\n`;
  text += '='.repeat(50) + '\n\n';
  
  playlist.episodes.forEach((episode, episodeIndex) => {
    text += `${episodeIndex + 1}. ${episode.episodeTitle}\n`;
    text += `   Published: ${episode.published}\n`;
    text += `   Music References: ${episode.remoteItems.length}\n`;
    
    episode.remoteItems.forEach((item, itemIndex) => {
      text += `   ${episodeIndex + 1}.${itemIndex + 1} Feed: ${item.feedGuid}`;
      if (item.itemGuid) {
        text += `, Item: ${item.itemGuid}`;
      }
      if (item.feedUrl) {
        text += `, URL: ${item.feedUrl}`;
      }
      text += '\n';
    });
    text += '\n';
  });
  
  return text;
}

function createCSVPlaylist(playlist) {
  let csv = 'Episode Title,Published Date,Feed GUID,Item GUID,Feed URL,Type\n';
  
  playlist.episodes.forEach(episode => {
    episode.remoteItems.forEach(item => {
      csv += `"${episode.episodeTitle}","${episode.published}","${item.feedGuid}","${item.itemGuid || ''}","${item.feedUrl || ''}","${item.type}"\n`;
    });
  });
  
  return csv;
}

// Run the script
createMusicPlaylist(); 