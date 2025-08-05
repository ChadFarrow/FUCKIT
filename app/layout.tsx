import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
// import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration' // Disabled to fix API issues
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
      { url: '/stablekraft-rocket.png', sizes: 'any', type: 'image/png' },
    ],
    apple: [
      { url: '/stablekraft-rocket.png', sizes: '180x180', type: 'image/png' },
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
      <body className={inter.className}>
        <ClientErrorBoundary>
          <ErrorBoundary>
            <AudioProvider>
              <div className="min-h-screen relative">
                {/* Background Image */}
                <div 
                  className="fixed inset-0 z-0"
                  style={{
                    background: 'url(/stablekraft-rocket.png) center/contain fixed',
                    backgroundAttachment: 'fixed',
                    opacity: 0.6
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
          <PerformanceMonitor />
        </ClientErrorBoundary>
      </body>
    </html>
  )
} 