import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '../styles/finamp-theme.css'
// import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration' // Disabled to fix API issues
import ErrorBoundary from '@/components/ErrorBoundary'
import ClientErrorBoundary from '@/components/ClientErrorBoundary'
import { ToastContainer } from '@/components/Toast'
import { AudioProvider } from '@/contexts/AudioContext'
import EnhancedNowPlaying from '@/components/EnhancedNowPlaying'
import PerformanceMonitor from '@/components/PerformanceMonitor'
import ScrollDetectionProvider from '@/components/ScrollDetectionProvider'



const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: false // Disable automatic preloading to prevent warnings
})

export const metadata: Metadata = {
  title: 'Project StableKraft - Music & Podcast Hub',
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
      { url: '/app-icon-new.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-152x152.png?v=20250806', sizes: '152x152', type: 'image/png' },
      { url: '/apple-touch-icon-144x144.png?v=20250806', sizes: '144x144', type: 'image/png' },
      { url: '/apple-touch-icon-120x120.png?v=20250806', sizes: '120x120', type: 'image/png' },
      { url: '/apple-touch-icon-76x76.png?v=20250806', sizes: '76x76', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Project StableKraft',
    startupImage: [
      {
        url: '/app-icon-new.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Project StableKraft',
    'mobile-web-app-capable': 'yes',
    'format-detection': 'telephone=no',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
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
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/stablekraft-rocket.png" />
        <link rel="shortcut icon" type="image/png" href="/stablekraft-rocket.png" />
        
        {/* Resource hints for performance */}
        <link rel="preconnect" href="https://www.doerfelverse.com" />
        <link rel="dns-prefetch" href="https://www.doerfelverse.com" />
        {/* Removed albums preload to avoid unused resource warning */}
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
      <body className={`${inter.className} finamp-theme`} style={{backgroundColor: 'var(--finamp-surface)'}}>
        <ClientErrorBoundary>
          <ErrorBoundary>
            <ScrollDetectionProvider>
              <AudioProvider>
                <div className="min-h-screen relative" style={{backgroundColor: 'var(--finamp-surface)'}}>
                  {/* Finamp-style background */}
                  <div 
                    className="fixed inset-0 z-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--finamp-surface) 0%, var(--finamp-surface-variant) 100%)',
                    }}
                  />
                  {/* Content overlay */}
                  <div className="relative z-10 finamp-container">
                    {children}
                  </div>
                </div>
                <EnhancedNowPlaying />
                <ToastContainer />
              </AudioProvider>
            </ScrollDetectionProvider>
          </ErrorBoundary>
          <PerformanceMonitor />
        </ClientErrorBoundary>
      </body>
    </html>
  )
} 