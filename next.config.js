const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // Completely disable service worker registration
  skipWaiting: true,
  disable: true, // Disable Service Worker for performance
  // Exclude RSC payloads and critical Next.js files from service worker caching
  exclude: [
    /_next\/static\/.*\/_buildManifest\.js$/,
    /_next\/static\/.*\/_ssgManifest\.js$/,
    /_next\/static\/.*\/_app-build-manifest\.json$/,
    /_next\/webpack-hmr/,
    /_next\/static\/.*\/.*\.js$/,
    /_next\/static\/.*\/.*\.mjs$/,
    /_next\/static\/.*\/.*\.css$/,
    /test-mobile-images/, // Exclude test pages from service worker
    /api\/proxy-image/, // Exclude proxy API from service worker
    /api\/optimized-images/, // Exclude optimized images API from service worker
    /api\/albums/, // Exclude albums API from service worker to prevent decoding issues
    /api\/parsed-feeds/, // Exclude parsed-feeds API from service worker
    /api\/feeds/, // Exclude feeds API from service worker
    /\?_rsc=/, // Exclude RSC payloads from service worker
    /album\/.*\?_rsc=/, // Exclude album RSC payloads
  ],
  runtimeCaching: [], // Disable all runtime caching
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Domain configuration for re.podtards.com deployment
  basePath: '',
  
  // Dynamic route configuration to prevent build issues
  experimental: {
    // Disable static generation for dynamic API routes
    workerThreads: false,
    cpus: 1,
  },
  
  // Revert static export - doesn't work with API routes
  // output: 'export',
  // trailingSlash: true,
  // distDir: 'out',

  
  // Image optimization configuration
  images: {
    // Performance optimizations - enable optimization but with better error handling
    unoptimized: false, // Re-enable optimization but with better configuration
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days for faster updates
    // Improved loading state configuration
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self' data:; script-src 'none'; img-src 'self' data: https:; sandbox;",
    // Use default loader with better error handling
    loader: 'default',
    loaderFile: undefined,
    // Add better error handling for image optimization
    disableStaticImages: false,
    // Configure domains for external images
    domains: [
      're.podtards.com',
      'www.doerfelverse.com',
      'www.thisisjdog.com',
      'www.sirtjthewrathful.com',
      'wavlake.com',
      'www.wavlake.com',
      'd12wklypp119aj.cloudfront.net',
      'ableandthewolf.com',
      'music.behindthesch3m3s.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.doerfelverse.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'feed.bowlafterbowl.com',
        port: '',
        pathname: '/**',
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
        hostname: 'static.wixstatic.com',
        port: '',
        pathname: '/**',
      },
      // RSS feed image domains that were causing HTTP 400 errors
      {
        protocol: 'https',
        hostname: 'noagendaassets.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.rssblue.com',
        port: '',
        pathname: '/**',
      },
      // Heycitizen domain
      {
        protocol: 'https',
        hostname: 'files.heycitizen.xyz',
        port: '',
        pathname: '/**',
      },
      // Bitpunk.fm domains
      {
        protocol: 'https',
        hostname: 'files.bitpunk.fm',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.bitpunk.fm',
        port: '',
        pathname: '/**',
      },
      // Anni Powell Music domain
      {
        protocol: 'https',
        hostname: 'annipowellmusic.com',
        port: '',
        pathname: '/**',
      },
      // Additional music domains
      {
        protocol: 'https',
        hostname: 'rocknrollbreakheart.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'rocknrollbreakheart.com',
        port: '',
        pathname: '/**',
      },
      // Placeholder image service
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      // Nostr image hosting
      {
        protocol: 'https',
        hostname: 'i.nostr.build',
        port: '',
        pathname: '/**',
      },
      // GitHub raw content for playlist artwork
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
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
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
}

module.exports = withPWA(nextConfig)