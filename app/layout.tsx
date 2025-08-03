import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import ErrorBoundary from '@/components/ErrorBoundary'
import ClientErrorBoundary from '@/components/ClientErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { AudioProvider } from '@/contexts/AudioContext'
import GlobalNowPlayingBar from '@/components/GlobalNowPlayingBar'
import PerformanceMonitor from '@/components/PerformanceMonitor'



const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: false // Disable automatic preloading to prevent warnings
})

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
      <head>
        {/* Resource hints for performance */}
        <link rel="preconnect" href="https://www.doerfelverse.com" />
        <link rel="dns-prefetch" href="https://www.doerfelverse.com" />
        <link rel="preload" href="/api/albums" as="fetch" crossOrigin="anonymous" />
        {/* Removed logo.webp preload as it's not immediately needed */}
        
        {/* Global Error Handler Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Global error handler for debugging
              window.addEventListener('error', function(event) {
                console.error('🔍 Layout error caught:', event.error);
                if (event.error && event.error.stack) {
                  console.error('Stack trace:', event.error.stack);
                }
              });

              window.addEventListener('unhandledrejection', function(event) {
                console.error('🔍 Layout promise rejection caught:', event.reason);
              });
            `
          }}
        />
      </head>
      <body className={inter.className}>
        <ClientErrorBoundary>
          <ErrorBoundary>
            <AudioProvider>
              <div className="min-h-screen bg-gray-50 relative">
                {/* Background Image */}
                <div 
                  className="fixed inset-0 z-0"
                  style={{
                    background: 'url(/bloodshot-lies-big.jpg) center/contain fixed',
                    backgroundAttachment: 'fixed',
                    opacity: 0.15
                  }}
                />
                {/* Content overlay */}
                <div className="relative z-10">
                  {children}
                </div>
              </div>
              <GlobalNowPlayingBar />
              <ToastContainer />
            </AudioProvider>
          </ErrorBoundary>
          <ServiceWorkerRegistration />
          <PerformanceMonitor />
        </ClientErrorBoundary>
      </body>
    </html>
  )
} 