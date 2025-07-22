# Into the ValueVerse 🎵

A modern music streaming web application that fetches and plays music from RSS feeds. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🎧 **RSS Feed Integration** - Fetches music data from RSS feeds
- 🎵 **Audio Playback** - Full-featured music player with play/pause controls
- 📱 **Responsive Design** - Beautiful, modern UI that works on all devices
- ⚡ **Real-time Updates** - Live progress tracking and time display
- 🎨 **Album Artwork** - Displays cover art from RSS feeds
- 🔍 **Track Management** - Complete track listing with durations

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Audio**: HTML5 Audio API
- **RSS Parsing**: Custom RSS parser for music feeds

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/into-the-valueverse.git
cd into-the-valueverse
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
FUCKIT/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── EpisodeCard.tsx
│   ├── Header.tsx
│   ├── LoadingSpinner.tsx
│   ├── PodcastCard.tsx
│   └── SearchBar.tsx
├── lib/                   # Utility libraries
│   ├── data-fetcher.ts    # RSS data fetching
│   └── rss-parser.ts      # RSS parsing logic
├── types/                 # TypeScript type definitions
│   └── music.ts
└── public/                # Static assets
```

## Features in Detail

### Audio Player
- **Play/Pause Controls**: Click any track to start playing
- **Progress Bar**: Visual progress indicator with seek functionality
- **Time Display**: Current time and total duration in MM:SS format
- **Track Highlighting**: Currently playing track is highlighted in green

### RSS Integration
- **Feed Parsing**: Automatically parses RSS feeds for music metadata
- **Album Information**: Displays title, artist, description, and cover art
- **Track Details**: Shows track numbers, titles, and durations

### UI/UX
- **Modern Design**: Clean, dark theme with purple/pink gradients
- **Responsive Layout**: Works seamlessly on desktop and mobile
- **Loading States**: Smooth loading animations and error handling
- **Hover Effects**: Interactive elements with smooth transitions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with ❤️ for the ValueVerse community
- Inspired by modern music streaming platforms
- Powered by Next.js and the open source community 