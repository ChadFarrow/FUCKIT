'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Heart, Share2 } from 'lucide-react';

const albums = [
  { id: 1, title: "Blurred at the Motion", artist: "Kurtisdrums", cover: "/api/placeholder/300/300", color: "from-red-500 to-orange-600", year: "2023", tracks: 12, duration: "45:23" },
  { id: 2, title: "Drive Hard", artist: "Various Artists", cover: "/api/placeholder/300/300", color: "from-blue-500 to-purple-600", year: "2023", tracks: 8, duration: "38:15" },
  { id: 3, title: "Dawn At The Alchemy Studios", artist: "Kurtisdrums", cover: "/api/placeholder/300/300", color: "from-green-500 to-blue-600", year: "2022", tracks: 15, duration: "52:47" },
  { id: 4, title: "Stay Awhile", artist: "Able and The Wolf", cover: "/api/placeholder/300/300", color: "from-yellow-500 to-red-600", year: "2023", tracks: 10, duration: "41:32" },
  { id: 5, title: "New Life", artist: "New Life", cover: "/api/placeholder/300/300", color: "from-gray-700 to-gray-900", year: "2023", tracks: 11, duration: "44:18" },
  { id: 6, title: "DOERFLFS", artist: "DOERFLFS", cover: "/api/placeholder/300/300", color: "from-orange-500 to-red-600", year: "2023", tracks: 9, duration: "36:55" },
  { id: 7, title: "Empath Eyes", artist: "Empath Eyes", cover: "/api/placeholder/300/300", color: "from-teal-500 to-blue-600", year: "2023", tracks: 13, duration: "48:22" },
  { id: 8, title: "In The Process", artist: "Kurtisdrums", cover: "/api/placeholder/300/300", color: "from-purple-500 to-pink-600", year: "2022", tracks: 14, duration: "50:15" },
  { id: 9, title: "The Sounds That I Kill You", artist: "The Sounds That I Kill You", cover: "/api/placeholder/300/300", color: "from-red-600 to-red-800", year: "2023", tracks: 12, duration: "46:33" },
  { id: 10, title: "Intrusion", artist: "Intrusion", cover: "/api/placeholder/300/300", color: "from-indigo-500 to-purple-600", year: "2023", tracks: 10, duration: "39:47" },
  { id: 11, title: "One Last Call", artist: "Intrusion", cover: "/api/placeholder/300/300", color: "from-green-600 to-teal-600", year: "2023", tracks: 8, duration: "32:18" },
  { id: 12, title: "Hey Artists", artist: "The Wolf", cover: "/api/placeholder/300/300", color: "from-yellow-600 to-orange-600", year: "2023", tracks: 11, duration: "43:25" },
  { id: 13, title: "Bloodshot Lee", artist: "The Doerfuls", cover: "/api/placeholder/300/300", color: "from-red-700 to-red-900", year: "2023", tracks: 12, duration: "47:12" },
  { id: 14, title: "Pine Rangers", artist: "Pine Rangers", cover: "/api/placeholder/300/300", color: "from-gray-600 to-gray-800", year: "2023", tracks: 9, duration: "35:44" },
  { id: 15, title: "Aubum Salt", artist: "Aubum Salt", cover: "/api/placeholder/300/300", color: "from-orange-400 to-yellow-500", year: "2023", tracks: 10, duration: "40:16" },
  { id: 16, title: "The Satellite Methods", artist: "The Satellite Methods", cover: "/api/placeholder/300/300", color: "from-blue-600 to-indigo-700", year: "2023", tracks: 11, duration: "42:33" },
  { id: 17, title: "DELTA OG", artist: "DELTA OG", cover: "/api/placeholder/300/300", color: "from-gray-500 to-gray-700", year: "2023", tracks: 8, duration: "31:27" },
  { id: 18, title: "FUCK THE HEDGEROW", artist: "FUCK THE HEDGEROW", cover: "/api/placeholder/300/300", color: "from-green-500 to-green-700", year: "2023", tracks: 12, duration: "45:55" },
  { id: 19, title: "Empath Eyes", artist: "Empath Eyes", cover: "/api/placeholder/300/300", color: "from-teal-400 to-cyan-600", year: "2023", tracks: 13, duration: "49:18" },
  { id: 20, title: "Way To Go", artist: "Syntagr", cover: "/api/placeholder/300/300", color: "from-purple-400 to-purple-600", year: "2023", tracks: 10, duration: "38:42" },
];

export default function AlbumDetailPage() {
  const params = useParams();
  const albumId = Number(params.id);
  const album = albums.find(a => a.id === albumId);

  if (!album) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Album Not Found</h1>
            <Link href="/" className="text-primary-400 hover:text-primary-300">
              ← Back to Albums
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Albums
        </Link>

        {/* Album Header */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="flex-shrink-0">
            <div className={`w-80 h-80 bg-gradient-to-br ${album.color} rounded-lg relative overflow-hidden flex items-center justify-center`}>
              <div className="absolute inset-0 bg-black bg-opacity-20"></div>
              <div className="text-white text-2xl font-bold text-center px-4">
                {album.title}
              </div>
            </div>
          </div>
          
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{album.title}</h1>
            <p className="text-xl text-gray-400 mb-4">{album.artist}</p>
            
            <div className="flex items-center gap-6 text-sm text-gray-400 mb-6">
              <span>{album.year}</span>
              <span>{album.tracks} tracks</span>
              <span>{album.duration}</span>
            </div>
            
            <div className="flex gap-4">
              <button className="bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-200 transition-colors flex items-center">
                <Play className="h-4 w-4 mr-2" />
                Play Album
              </button>
              <button className="border border-gray-600 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center">
                <Heart className="h-4 w-4 mr-2" />
                Save
              </button>
              <button className="border border-gray-600 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Track List */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Tracks</h2>
          <div className="space-y-2">
            {Array.from({ length: album.tracks }, (_, i) => (
              <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-lg transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 text-sm w-8">{i + 1}</span>
                  <div>
                    <p className="font-medium">Track {i + 1}</p>
                    <p className="text-sm text-gray-400">{album.artist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">
                    {Math.floor(Math.random() * 4) + 2}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}
                  </span>
                  <button className="text-gray-400 hover:text-white">
                    <Play className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}