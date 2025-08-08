# Homegrown Hits Music Playlist

This is a music playlist RSS feed created from the [Homegrown Hits podcast](https://feed.homegrownhits.xyz/feed.xml).

## Overview

- **Source**: Homegrown Hits podcast feed
- **Format**: RSS 2.0 with Podcast Index namespace
- **Medium**: Music playlist
- **Episodes**: 98 episodes processed
- **Total Tracks**: 1,187 tracks extracted

## Structure

The playlist follows the same structure as the ITDV playlist:

- Each episode becomes a playlist item
- Tracks are extracted from episode descriptions
- Uses `podcast:remoteItem` elements for track references
- Maintains original episode metadata (title, pubDate, guid, etc.)

## Generation

The playlist is generated using the `create-homegrown-hits-playlist.js` script which:

1. Fetches the Homegrown Hits RSS feed
2. Parses episode descriptions to extract track information
3. Creates a new RSS feed with music playlist structure
4. Saves the result as `homegrown-hits-music-playlist.xml`

## Usage

The playlist can be used with any podcast player that supports the Podcast Index namespace and `podcast:remoteItem` elements.

## Files

- `homegrown-hits-music-playlist.xml` - The generated playlist RSS feed
- `create-homegrown-hits-playlist.js` - Script to generate the playlist

## Similar Playlists

This follows the same pattern as the [ITDV music playlist](https://chadfarrow.github.io/ITDV-music-playlist/doerfel-verse-music.xml) created for the Into The Doerfel-Verse podcast.
