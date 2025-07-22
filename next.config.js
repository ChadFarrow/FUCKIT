/** @type {import('next').NextConfig} */
const nextConfig = {
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
      // Bunny.net CDN
      {
        protocol: 'https',
        hostname: process.env.BUNNY_CDN_HOSTNAME || 'your-zone.b-cdn.net',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true, // Allow animated GIFs and other unoptimized images
  },
}

module.exports = nextConfig