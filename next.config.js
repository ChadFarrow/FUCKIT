/** @type {import('next').NextConfig} */
const nextConfig = {
  // Domain configuration for re.podtards.com deployment
  basePath: '',

  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.doerfelverse.com',
        port: '',
        pathname: '/art/**',
      },
      {
        protocol: 'https',
        hostname: 'www.thisisjdog.com',
        port: '',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'www.sirtjthewrathful.com',
        port: '',
        pathname: '/wp-content/**',
      },
      {
        protocol: 'https',
        hostname: 'wavlake.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.wavlake.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'd12wklypp119aj.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ableandthewolf.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'music.behindthesch3m3s.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'whiterabbitrecords.org',
        port: '',
        pathname: '/wp-content/**',
      },
                      {
                  protocol: 'https',
                  hostname: 'feed.falsefinish.club',
                  port: '',
                  pathname: '/**',
                },
                {
                  protocol: 'https',
                  hostname: 'f4.bcbits.com',
                  port: '',
                  pathname: '/**',
                },
      // Bunny.net CDN - Dynamic hostname support
      {
        protocol: 'https',
        hostname: process.env.BUNNY_CDN_HOSTNAME || 're-podtards.b-cdn.net',
        port: '',
        pathname: '/**',
      },
      // re.podtards.com domain
      {
        protocol: 'https',
        hostname: 're.podtards.com',
        port: '',
        pathname: '/**',
      },
      // Fallback for local development
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      // Additional CDN and image hosting domains
      {
        protocol: 'https',
        hostname: 'd12wklypp119aj.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 're-podtards.b-cdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.wixstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'music.behindthesch3m3s.com',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'development', // Optimize in production
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Performance and caching
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Headers for CDN and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig