'use client';

import Link from 'next/link';

interface PlaylistItem {
  id: string;
  title: string;
  description: string;
  trackCount: number;
  episodes: string;
  href: string;
  type: 'web' | 'rss';
  color: string;
}

const playlists: PlaylistItem[] = [
  {
    id: 'itdv',
    title: 'Into The Doerfel-Verse',
    description: 'Music from Into The Doerfel-Verse podcast episodes',
    trackCount: 200,
    episodes: 'Episodes 31-56',
    href: '/playlist/itdv',
    type: 'web',
    color: 'bg-blue-600'
  },
  {
    id: 'itdv-rss',
    title: 'ITDV RSS Feed',
    description: 'Podcasting 2.0 compliant RSS feed for music discovery',
    trackCount: 200,
    episodes: 'Episodes 31-56',
    href: '/playlist/itdv-rss',
    type: 'rss',
    color: 'bg-green-600'
  },
  {
    id: 'hgh',
    title: 'Homegrown Hits',
    description: 'Music from Homegrown Hits podcast',
    trackCount: 150,
    episodes: 'Various Episodes',
    href: '/playlist/hgh',
    type: 'web',
    color: 'bg-purple-600'
  },
  {
    id: 'lightning-thrashes',
    title: 'Lightning Thrashes',
    description: 'Music from Lightning Thrashes podcast',
    trackCount: 100,
    episodes: 'Various Episodes',
    href: '/playlist/lightning-thrashes',
    type: 'web',
    color: 'bg-red-600'
  }
];

export default function PlaylistIndexPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">Music Playlists</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Discover and enjoy music from various podcasts and creators. 
            Choose between web players and RSS feeds for your preferred listening experience.
          </p>
        </div>

        {/* Playlist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              {/* Type Badge */}
              <div className="flex justify-between items-start mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  playlist.type === 'rss' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {playlist.type === 'rss' ? '📡 RSS Feed' : '🌐 Web Player'}
                </span>
                <div className={`w-3 h-3 rounded-full ${playlist.color}`}></div>
              </div>

              {/* Title and Description */}
              <h3 className="text-xl font-bold mb-2">{playlist.title}</h3>
              <p className="text-gray-300 text-sm mb-4">{playlist.description}</p>

              {/* Stats */}
              <div className="flex justify-between text-sm text-gray-400 mb-6">
                <span>{playlist.trackCount} tracks</span>
                <span>{playlist.episodes}</span>
              </div>

              {/* Action Button */}
              <Link
                href={playlist.href}
                className={`block w-full text-center py-3 px-4 rounded-lg font-medium transition-colors ${
                  playlist.type === 'rss'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {playlist.type === 'rss' ? '📥 Get RSS Feed' : '🎵 Open Player'}
              </Link>
            </div>
          ))}
        </div>

        {/* RSS Feed Information */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">About RSS Feeds</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-300 mb-2">What are RSS Feeds?</h3>
              <p className="text-sm text-gray-400 mb-4">
                RSS feeds allow you to subscribe to music playlists in your favorite podcast apps. 
                They&apos;re compatible with Podcasting 2.0 apps and support Value4Value payments.
              </p>
              <h3 className="font-semibold text-gray-300 mb-2">Compatible Apps:</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Fountain</li>
                <li>• Podverse</li>
                <li>• Breez</li>
                <li>• Any Podcasting 2.0 app</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-300 mb-2">Features:</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Podcasting 2.0 compliant</li>
                <li>• Value4Value (V4V) support</li>
                <li>• Cross-feed references</li>
                <li>• Music track metadata</li>
                <li>• Offline listening</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/api/playlist/itdv-rss"
              download="ITDV-playlist.xml"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              📥 Download ITDV RSS
            </a>
            <Link
              href="/playlist/itdv"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🎵 Open ITDV Player
            </Link>
            <Link
              href="/playlist/hgh"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🎵 Open HGH Player
            </Link>
            <Link
              href="/playlist/maker"
              className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🛠️ Open Playlist Maker
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 