# Deployment Guide: re.podtards.com with Bunny.net CDN

This guide walks you through deploying the music app to `re.podtards.com` with Bunny.net CDN integration.

## Prerequisites

1. **Bunny.net Account**: Sign up at [bunny.net](https://bunny.net)
2. **Domain Access**: Control over `re.podtards.com` DNS settings
3. **Deployment Platform**: Vercel, Netlify, or similar (configured for Vercel)

## Step 1: Set up Bunny.net CDN

### 1.1 Create a Pull Zone
1. Log into your Bunny.net dashboard
2. Go to "Pull Zones" and click "Add Pull Zone"
3. Configure:
   - **Zone Name**: `re-podtards`
   - **Origin URL**: `https://re.podtards.com`
   - **Optimization**: Enable "Image Optimization"
   - **Caching**: Enable "Browser Cache Expiration" (7 days)

### 1.2 Configure CDN Settings
1. In your pull zone settings:
   - Enable **Bunny Optimizer** for image optimization
   - Enable **WebP Conversion**
   - Set **Cache Control** to 30 days for static assets
   - Enable **Gzip Compression**

### 1.3 Get Your CDN Details
Note down:
- **CDN Hostname**: `re-podtards.b-cdn.net` (or your custom domain)
- **Zone Name**: `re-podtards`
- **API Key**: Found in Account Settings > API

## Step 2: Configure Environment Variables

### For Vercel Deployment:

Add these environment variables in your Vercel dashboard:

```bash
# Bunny.net CDN Configuration
BUNNY_CDN_HOSTNAME=re-podtards.b-cdn.net
BUNNY_CDN_ZONE=re-podtards
BUNNY_CDN_API_KEY=your-bunny-api-key-here

# CDN URLs
NEXT_PUBLIC_CDN_URL=https://re-podtards.b-cdn.net

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://re.podtards.com
NEXT_PUBLIC_API_URL=https://re.podtards.com/api
NODE_ENV=production
```

### Vercel Secret Variables:
Set these as secrets in Vercel:
```bash
vercel secrets add bunny_cdn_hostname "re-podtards.b-cdn.net"
vercel secrets add bunny_cdn_zone "re-podtards"
vercel secrets add bunny_cdn_api_key "your-actual-api-key"
vercel secrets add next_public_cdn_url "https://re-podtards.b-cdn.net"
```

## Step 3: DNS Configuration

### 3.1 Point Domain to Vercel
1. In your DNS provider, add a CNAME record:
   ```
   re.podtards.com -> cname.vercel-dns.com
   ```

### 3.2 Configure Vercel Domain
1. In Vercel dashboard, go to your project settings
2. Add `re.podtards.com` as a custom domain
3. Verify SSL certificate is issued

## Step 4: Deploy Application

### 4.1 Deploy to Vercel
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy
vercel --prod
```

### 4.2 Set Custom Domain
```bash
# Add domain in Vercel
vercel domains add re.podtards.com
```

## Step 5: Test Deployment

### 5.1 Verify Site Access
- Visit `https://re.podtards.com`
- Check that all albums load properly
- Verify RSS feeds are accessible

### 5.2 Test CDN Integration
- Check browser DevTools Network tab
- Verify images are loading from `re-podtards.b-cdn.net`
- Test image optimization (WebP format)

### 5.3 Performance Check
- Run Lighthouse audit
- Verify Core Web Vitals
- Check CDN cache hits in Bunny.net dashboard

## Step 6: CDN Optimization (Optional)

### 6.1 Custom CDN Domain
If you want images served from your domain:
1. Add `cdn.re.podtards.com` CNAME to `re-podtards.b-cdn.net`
2. Update environment variable:
   ```bash
   BUNNY_CDN_HOSTNAME=cdn.re.podtards.com
   ```

### 6.2 Cache Purging
The app includes cache purging utilities:
```javascript
import { purgeCDNCache, purgeEntireCDNCache } from '@/lib/cdn-utils';

// Purge specific URL
await purgeCDNCache('https://re-podtards.b-cdn.net/path/to/image.jpg');

// Purge entire cache
await purgeEntireCDNCache();
```

## Troubleshooting

### Common Issues:

1. **Images not loading from CDN**
   - Check `BUNNY_CDN_HOSTNAME` environment variable
   - Verify CDN zone is properly configured
   - Check Next.js image domains in `next.config.js`

2. **RSS feeds failing**
   - Check CORS headers in API routes
   - Verify domain whitelist in production
   - Check API timeout settings

3. **Domain not accessible**
   - Verify DNS propagation (use dig or online tools)
   - Check Vercel domain configuration
   - Ensure SSL certificate is issued

### Support Commands:

```bash
# Check DNS
dig re.podtards.com

# Test SSL
curl -I https://re.podtards.com

# Check CDN
curl -I https://re-podtards.b-cdn.net

# View deployment logs
vercel logs
```

## Performance Monitoring

Monitor your deployment:
- **Bunny.net Dashboard**: CDN performance, cache hit ratio
- **Vercel Analytics**: Page load times, Core Web Vitals  
- **Browser DevTools**: Network timing, resource loading

## Security Notes

- All API keys are stored as Vercel secrets
- CORS is properly configured for production domain
- Security headers are set in `next.config.js`
- Images are served over HTTPS only

## Next Steps

After deployment:
1. Set up monitoring and alerts
2. Configure automatic deployments on git push
3. Set up CDN cache invalidation on content updates
4. Consider adding a custom 404 page
5. Set up analytics and error tracking