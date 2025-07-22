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
    ],
    unoptimized: true, // Allow animated GIFs and other unoptimized images
  },
}

module.exports = nextConfig