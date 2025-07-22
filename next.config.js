/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['www.doerfelverse.com'],
  },
  // Add explicit build settings
  experimental: {
    // Disable some experimental features that might cause issues
    optimizePackageImports: [],
  },
  // Ensure proper output
  output: 'standalone',
}

module.exports = nextConfig 