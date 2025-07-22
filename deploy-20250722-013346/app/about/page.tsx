import Header from '@/components/Header';
import { Music, Mic, Search, Globe, Zap, Heart } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const features = [
    {
      icon: Search,
      title: 'Advanced Search',
      description: 'Search through thousands of podcasts and music feeds with powerful filtering options.'
    },
    {
      icon: Music,
      title: 'Music Discovery',
      description: 'Find music podcasts, interviews, and audio content from around the world.'
    },
    {
      icon: Mic,
      title: 'Podcast Hub',
      description: 'Browse trending podcasts and discover new content across all categories.'
    },
    {
      icon: Globe,
      title: 'RSS Integration',
      description: 'Built on the Podcast Index API for comprehensive RSS feed coverage.'
    },
    {
      icon: Zap,
      title: 'Fast Performance',
      description: 'Built with Next.js for optimal speed and user experience.'
    },
    {
      icon: Heart,
      title: 'Open Source',
      description: 'Completely open source and built for the podcast community.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              About Podcast & Music Hub
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              A modern web application for discovering and exploring podcasts and music content 
              from the Podcast Index. Built with love for the audio community.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              What We Do
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Podcast & Music Hub is a comprehensive platform that connects you with the best 
              podcasts and music content available on the web. We aggregate data from the 
              Podcast Index API, which maintains one of the largest databases of podcast feeds 
              and episodes.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Whether you're looking for the latest music interviews, educational podcasts, 
              or just want to discover new content, our platform makes it easy to find 
              exactly what you're looking for.
            </p>
          </div>

          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              Key Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center mb-4">
                      <Icon className="h-8 w-8 text-primary-600 mr-3" />
                      <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                    </div>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Technology Stack
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Frontend</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Next.js 14 with App Router</li>
                  <li>• TypeScript for type safety</li>
                  <li>• Tailwind CSS for styling</li>
                  <li>• Lucide React for icons</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Backend & APIs</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Podcast Index API</li>
                  <li>• RSS feed parsing</li>
                  <li>• Axios for HTTP requests</li>
                  <li>• date-fns for date handling</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              About Podcast Index
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              The Podcast Index is an open-source podcast database that maintains a comprehensive 
              index of podcast feeds and episodes. It provides a powerful API that allows 
              developers to search, discover, and access podcast data.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Our application leverages this API to provide you with the most up-to-date 
              information about podcasts and episodes, including metadata, RSS feeds, and 
              direct download links.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://podcastindex.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-center"
              >
                Visit Podcast Index
              </a>
              <a
                href="https://api.podcastindex.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-center"
              >
                API Documentation
              </a>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Get Started
            </h2>
            <p className="text-gray-600 mb-6">
              Ready to discover amazing podcasts and music content?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/" className="btn-primary">
                Browse Podcasts
              </Link>
              <Link href="/music" className="btn-secondary">
                Explore Music
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 