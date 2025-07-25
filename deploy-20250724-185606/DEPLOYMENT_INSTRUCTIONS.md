# Deployment Instructions for re.podtards.com

## Prerequisites
- Node.js 18+ installed on your server
- PM2 installed globally: `npm install -g pm2`
- Nginx installed and configured
- SSL certificates for re.podtards.com

## Deployment Steps

### 1. Upload files to server
```bash
# Upload the deploy-20250724-185606 folder to your server
scp -r deploy-20250724-185606 user@your-server:/tmp/
```

### 2. On your server, set up the application
```bash
# Create application directory
sudo mkdir -p /var/www/re.podtards.com
sudo chown $USER:$USER /var/www/re.podtards.com

# Move files to application directory
mv /tmp/deploy-20250724-185606/* /var/www/re.podtards.com/

# Install dependencies
cd /var/www/re.podtards.com
npm install --production

# Set up environment variables
# Edit .env.production with your actual CDN API key
nano .env.production
```

### 3. Configure Nginx
```bash
# Copy nginx configuration
sudo cp /var/www/re.podtards.com/nginx.conf /etc/nginx/sites-available/re.podtards.com

# Enable the site
sudo ln -s /etc/nginx/sites-available/re.podtards.com /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 4. Start the application with PM2
```bash
cd /var/www/re.podtards.com
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Configure DNS
Add this CNAME record in your DNS provider:
```
Type: CNAME
Name: re
Value: [your-server-ip]
TTL: 300
```

## Verification
- Visit https://re.podtards.com
- Check that images are being served through your CDN
- Monitor logs: `pm2 logs fuckit-app`

## Troubleshooting
- Check PM2 status: `pm2 status`
- Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check application logs: `pm2 logs fuckit-app`
