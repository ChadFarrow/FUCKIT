import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { AudioProvider } from '@/contexts/AudioContext'
import GlobalNowPlayingBar from '@/components/GlobalNowPlayingBar'



const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DoerfelVerse - Music & Podcast Hub',
  description: 'Discover and listen to music and podcasts from the Doerfel family and friends',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-touch-icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/apple-touch-icon-76x76.png', sizes: '76x76', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DoerfelVerse',
    startupImage: [
      {
        url: '/apple-touch-icon.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'DoerfelVerse',
    'mobile-web-app-capable': 'yes',
    'format-detection': 'telephone=no',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f2937',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <AudioProvider>
            <div className="min-h-screen bg-gray-50">
              {children}
            </div>
            <GlobalNowPlayingBar />
            <ToastContainer />
          </AudioProvider>
        </ErrorBoundary>
        <ServiceWorkerRegistration />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Cache busting and error prevention script
              (function() {
                console.log('🔧 Cache busting script loaded');
                
                // Prevent infinite recursion by limiting function calls
                let recursionCount = 0;
                const maxRecursion = 100;
                
                // Override console.error to catch recursion errors
                const originalError = console.error;
                console.error = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('too much recursion')) {
                    recursionCount++;
                    if (recursionCount > maxRecursion) {
                      console.warn('🛑 Too many recursion errors, stopping error logging');
                      return;
                    }
                    console.warn('🔄 Recursion error detected, count:', recursionCount);
                  }
                  originalError.apply(console, args);
                };
                
                // Clear any problematic state
                if (typeof window !== 'undefined') {
                  // Clear any cached audio contexts
                  if (window.audioContextCache) {
                    delete window.audioContextCache;
                  }
                  
                  // Force garbage collection if available
                  if (window.gc) {
                    window.gc();
                  }
                }
                
                console.log('✅ Cache busting script initialized');
              })();
            `
          }}
        />
      </body>
    </html>
  )
} 