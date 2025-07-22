# Bunny.net CDN Setup Guide

This guide will help you set up Bunny.net as a CDN for your Next.js podcast and music hub application.

## 🚀 Quick Setup

1. **Run the setup script:**
   ```bash
   npm run setup-cdn
   ```

2. **Follow the prompts** to enter your Bunny.net credentials

3. **Restart your development server:**
   ```bash
   npm run dev
   ```

## 📋 Manual Setup Steps

### 1. Create Bunny.net Account

1. Sign up at [bunny.net](https://bunny.net/)
2. Choose a plan (Standard Tier is recommended for most use cases)

### 2. Create a Pull Zone

1. Go to your Bunny.net dashboard
2. Click "Add Pull Zone"
3. Configure with these settings:
   - **Pull Zone Name**: Choose a name (e.g., `your-app-cdn`)
   - **Origin Type**: Select "Origin URL"
   - **Origin URL**: Your website URL (e.g., `https://yourdomain.com`)
   - **Choose Tier**: Standard Tier
   - **Pricing Zones**: Select the zones you want to serve content from

### 3. Configure Environment Variables

Create a `.env.local` file in your project root:

```env
# Podcast Index API Credentials
PODCAST_INDEX_API_KEY=your-api-key-here
PODCAST_INDEX_API_SECRET=your-api-secret-here

# Bunny.net CDN Configuration
BUNNY_CDN_HOSTNAME=your-zone.b-cdn.net
BUNNY_CDN_ZONE=your-zone
BUNNY_CDN_API_KEY=your-api-key-here
```

### 4. Get Your API Key (Optional)

For cache purging functionality:
1. Go to your Bunny.net dashboard
2. Navigate to "API" section
3. Generate an API key
4. Add it to your `.env.local` file

## 🖼️ Using CDN in Your Components

### Replace Image Components

Instead of using Next.js `Image` directly, use the `CDNImage` component:

```tsx
import CDNImage from '@/components/CDNImage';

// Before
<Image src="/album-art.jpg" alt="Album Art" width={300} height={300} />

// After
<CDNImage src="/album-art.jpg" alt="Album Art" width={300} height={300} />
```

### Using CDN Utilities

```tsx
import { getCDNUrl, getAlbumArtworkUrl, purgeCDNCache } from '@/lib/cdn-utils';

// Generate optimized CDN URL
const optimizedUrl = getCDNUrl('https://example.com/image.jpg', {
  width: 300,
  height: 300,
  quality: 85,
  format: 'webp'
});

// Get album artwork with optimal settings
const artworkUrl = getAlbumArtworkUrl('https://example.com/album.jpg', 'large');

// Purge cache when content updates
await purgeCDNCache('https://example.com/image.jpg');
```

## 🔧 CDN Configuration Options

### Image Optimization Parameters

- `width`: Target width in pixels
- `height`: Target height in pixels
- `quality`: JPEG quality (1-100)
- `format`: Output format (`webp`, `jpeg`, `png`, `gif`)
- `fit`: Resize mode (`cover`, `contain`, `fill`, `inside`, `outside`)

### Predefined Functions

- `getAlbumArtworkUrl(url, size)`: Optimized album artwork
  - `size`: `'thumbnail'` (150x150), `'medium'` (300x300), `'large'` (600x600)
- `getTrackArtworkUrl(url)`: Optimized track artwork (200x200)

## 🧪 Testing Your CDN Setup

1. **Check Network Requests**: Open browser dev tools and look for requests to your CDN domain
2. **Verify Image Optimization**: Check that images are being served with optimization parameters
3. **Test Fallback**: Temporarily disable CDN to ensure fallback works

### Debug Commands

```bash
# Check CDN configuration
node -e "console.log(require('./lib/cdn-utils').getCDNConfig())"

# Test CDN URL generation
node -e "console.log(require('./lib/cdn-utils').getCDNUrl('https://example.com/image.jpg', {width: 300}))"
```

## 🚨 Troubleshooting

### Common Issues

1. **Images not loading through CDN**
   - Check that `BUNNY_CDN_HOSTNAME` is set correctly
   - Verify the pull zone is active in Bunny.net dashboard
   - Ensure the origin URL is accessible

2. **CDN cache not updating**
   - Use the purge functions to clear cache
   - Check that the API key has purge permissions

3. **Performance issues**
   - Monitor Bunny.net dashboard for bandwidth usage
   - Consider upgrading to High Volume Tier if needed

### Error Messages

- `"CDN API key or zone not configured"`: Set up environment variables
- `"Invalid URL for CDN processing"`: Check URL format
- `"Failed to purge CDN cache"`: Verify API key and permissions

## 📊 Monitoring

Monitor your CDN performance in the Bunny.net dashboard:
- Bandwidth usage
- Cache hit rates
- Geographic distribution
- Error rates

## 🔄 Cache Management

### Automatic Purge on Content Update

```tsx
// In your content management functions
import { purgeCDNCache } from '@/lib/cdn-utils';

async function updateAlbumArtwork(albumId: string, newImageUrl: string) {
  // Update your database
  await updateAlbum(albumId, { imageUrl: newImageUrl });
  
  // Purge old image from CDN cache
  await purgeCDNCache(oldImageUrl);
}
```

### Manual Cache Purge

```tsx
import { purgeEntireCDNCache } from '@/lib/cdn-utils';

// Purge entire cache (use sparingly)
await purgeEntireCDNCache();
```

## 💰 Cost Optimization

- **Standard Tier**: Good for most use cases, $10/TB
- **High Volume Tier**: Better for large files, $5/TB
- **Geographic Zones**: Choose only the zones you need
- **Cache Settings**: Optimize cache duration for your content type

## 🔒 Security

- Keep your API key secure
- Use environment variables, never commit secrets
- Consider IP restrictions in Bunny.net dashboard
- Monitor for unusual traffic patterns

## 📚 Additional Resources

- [Bunny.net Documentation](https://docs.bunny.net/)
- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [CDN Best Practices](https://docs.bunny.net/docs/cdn) 