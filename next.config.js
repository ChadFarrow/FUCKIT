/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.podcastindex.org',
      },
      {
        protocol: 'https',
        hostname: 'cdn-images.podcastindex.org',
      },
      {
        protocol: 'https',
        hostname: 'www.doerfelverse.com',
      },
    ],
  },
}

module.exports = nextConfig 