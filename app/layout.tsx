import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DoerfelVerse - Music & Podcast Hub',
  description: 'Discover and listen to music and podcasts from the Doerfel family and friends',
  manifest: '/manifest.json',
  themeColor: '#1f2937',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
} 