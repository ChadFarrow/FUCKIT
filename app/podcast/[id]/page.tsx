'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { MusicSiteDataFetcher } from '@/lib/data-fetcher';
import { Podcast, Episode } from '@/types/podcast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function PodcastDetailPage() {
  const params = useParams();
  const podcastId = Number(params.id);
  
  const [podcastData, setPodcastData] = useState<{
    podcast: Podcast;
    episodes: Episode[];
    similarPodcasts: Podcast[];
    recentEpisodes: Episode[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (podcastId) {
      loadPodcastData();
    }
  }, [podcastId]);

  const loadPodcastData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Loading podcast data for ID: ${podcastId}`);
      
      const data = await MusicSiteDataFetcher.getPodcastWithEpisodes(podcastId);
      if (data) {
        setPodcastData(data);
        console.log('Podcast data loaded:', {
          title: data.podcast.title,
          episodes: data.episodes.length,
          similar: data.similarPodcasts.length
        });
      } else {
        setError('Podcast not found');
      }
    } catch (err) {
      setError('Failed to load podcast data');
      console.error('Error loading podcast data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !podcastData) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-6 py-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Home
          </Link>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Podcast Not Found</h1>
            <p className="text-gray-400">{error || 'The requested podcast could not be found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { podcast, episodes, similarPodcasts, recentEpisodes } = podcastData;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
          ← Back to Home
        </Link>

        {/* Podcast Header */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="flex-shrink-0">
            <div className="w-64 h-64 rounded-lg overflow-hidden bg-gray-800">
              {podcast.image ? (
                <Image
                  src={podcast.image}
                  alt={podcast.title}
                  width={256}
                  height={256}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <span className="text-white text-lg font-bold text-center px-4">
                    {podcast.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">{podcast.title}</h1>
            <p className="text-xl text-gray-300 mb-4">
              by {podcast.author || podcast.ownerName || 'Unknown Artist'}
            </p>
            
            {podcast.description && (
              <p className="text-gray-400 mb-6 leading-relaxed">
                {podcast.description}
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{episodes.length}</div>
                <div className="text-sm text-gray-400">Episodes</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{podcast.episodeCount || 0}</div>
                <div className="text-sm text-gray-400">Total</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{similarPodcasts.length}</div>
                <div className="text-sm text-gray-400">Similar</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {podcast.lastUpdateTime ? formatDate(podcast.lastUpdateTime.toString()) : 'N/A'}
                </div>
                <div className="text-sm text-gray-400">Updated</div>
              </div>
            </div>

            {podcast.categories && (
              <div className="flex flex-wrap gap-2 mb-6">
                {Object.entries(podcast.categories).map(([key, value]) => (
                  <span key={key} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                    {value}
                  </span>
                ))}
              </div>
            )}

            {podcast.funding && podcast.funding.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Support This Podcast</h3>
                <div className="space-y-2">
                  {podcast.funding.map((fund, index) => (
                    <a
                      key={index}
                      href={fund.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-gray-900 hover:bg-gray-800 rounded-lg p-3 transition-colors"
                    >
                      <div className="font-medium">{fund.title}</div>
                      <div className="text-sm text-gray-400">{fund.description}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Episodes */}
        {recentEpisodes.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Recent Episodes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentEpisodes.slice(0, 6).map((episode) => (
                <div key={episode.id} className="bg-gray-900 rounded-lg p-6">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">{episode.title}</h3>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                    {episode.description || 'No description available'}
                  </p>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                    <span>{formatDate(episode.datePublished.toString())}</span>
                    {episode.duration && (
                      <span>{formatDuration(episode.duration)}</span>
                    )}
                  </div>

                  {episode.enclosureUrl && (
                    <audio controls className="w-full">
                      <source src={episode.enclosureUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  )}

                  {episode.transcriptUrl && (
                    <a
                      href={episode.transcriptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View Transcript →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Episodes */}
        {episodes.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">All Episodes</h2>
            <div className="space-y-4">
              {episodes.map((episode) => (
                <div key={episode.id} className="bg-gray-900 rounded-lg p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{episode.title}</h3>
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                        {episode.description || 'No description available'}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span>{formatDate(episode.datePublished.toString())}</span>
                        {episode.duration && (
                          <span>{formatDuration(episode.duration)}</span>
                        )}
                        {episode.episode && (
                          <span>Episode {episode.episode}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {episode.enclosureUrl && (
                        <audio controls className="w-full md:w-64">
                          <source src={episode.enclosureUrl} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                    </div>
                  </div>

                  {episode.chapters && episode.chapters.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <h4 className="font-medium mb-2">Chapters</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {episode.chapters.map((chapter, index) => (
                          <div key={index} className="text-sm">
                            <span className="text-gray-400">
                              {formatDuration(chapter.startTime)} - {chapter.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Podcasts */}
        {similarPodcasts.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Similar Podcasts</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {similarPodcasts.map((similarPodcast) => (
                <Link
                  key={similarPodcast.id}
                  href={`/podcast/${similarPodcast.id}`}
                  className="group cursor-pointer"
                >
                  <div className="bg-gray-900 rounded-lg p-4 transition-transform hover:scale-105 hover:bg-gray-800">
                    <div className="aspect-square rounded-lg mb-3 relative overflow-hidden">
                      {similarPodcast.image ? (
                        <Image
                          src={similarPodcast.image}
                          alt={similarPodcast.title}
                          width={200}
                          height={200}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold text-center px-2">
                            {similarPodcast.title}
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1 truncate">{similarPodcast.title}</h3>
                    <p className="text-gray-400 text-xs truncate">
                      {similarPodcast.author || similarPodcast.ownerName}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {similarPodcast.episodeCount || 0} episodes
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* RSS Feed Info */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">RSS Feed Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Feed URL:</strong>
              <a
                href={podcast.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 ml-2 break-all"
              >
                {podcast.url}
              </a>
            </div>
            <div>
              <strong>Website:</strong>
              {podcast.link && (
                <a
                  href={podcast.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 ml-2"
                >
                  Visit Website
                </a>
              )}
            </div>
            <div>
              <strong>Language:</strong>
              <span className="ml-2">{podcast.language || 'Unknown'}</span>
            </div>
            <div>
              <strong>Country:</strong>
              <span className="ml-2">{podcast.country || 'Unknown'}</span>
            </div>
            <div>
              <strong>Last Updated:</strong>
              <span className="ml-2">
                {podcast.lastUpdateTime ? formatDate(podcast.lastUpdateTime.toString()) : 'Unknown'}
              </span>
            </div>
            <div>
              <strong>Feed ID:</strong>
              <span className="ml-2">{podcast.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 