# FUCKIT - Podcast & Music Hub

A Next.js application for discovering and streaming podcasts and music from various RSS feeds.

## Features

- 🎵 Music streaming from RSS feeds
- 🎧 Podcast discovery and playback
- 🖼️ CDN-powered image optimization with Bunny.net
- 🚀 Automatic deployment with GitHub Actions
- 📱 Responsive design

## Quick Start

```bash
npm install
npm run dev
```

## CDN Setup

This app uses Bunny.net CDN for image optimization. See `CDN_SETUP.md` for configuration details.

## Auto-Deployment

The app automatically deploys to `re.podtards.com` when you push to the main branch.

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `BUNNY_CDN_HOSTNAME` - Your Bunny.net CDN hostname
- `BUNNY_CDN_ZONE` - Your Bunny.net pull zone name
- `BUNNY_CDN_API_KEY` - Your Bunny.net API key (optional)

## Deployment

- **Automatic:** Push to main branch (GitHub Actions)
- **Manual:** `npm run auto-deploy` 