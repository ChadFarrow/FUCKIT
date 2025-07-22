#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupCDN() {
  console.log('🚀 Bunny.net CDN Setup for re.podtards.com Music App\n');
  
  console.log('To get your Bunny.net credentials:');
  console.log('1. Sign up at https://bunny.net/');
  console.log('2. Create a Pull Zone with origin URL: https://re.podtards.com');
  console.log('3. Enable Image Optimization in the pull zone settings');
  console.log('4. Get your API key from Account Settings > API\n');
  
  const useDefaults = await question('Use default settings for re.podtards.com? (y/n): ');
  
  let hostname, zone, apiKey;
  
  if (useDefaults.toLowerCase() === 'y' || useDefaults.toLowerCase() === 'yes') {
    hostname = 're-podtards.b-cdn.net';
    zone = 're-podtards';
    apiKey = await question('Enter your Bunny.net API key (for cache purging): ');
  } else {
    hostname = await question('Enter your CDN hostname (e.g., re-podtards.b-cdn.net): ');
    zone = await question('Enter your pull zone name (e.g., re-podtards): ');
    apiKey = await question('Enter your Bunny.net API key (optional, for purging): ');
  }
  
  const envContent = `# Bunny.net CDN Configuration for re.podtards.com
BUNNY_CDN_HOSTNAME=${hostname}
BUNNY_CDN_ZONE=${zone}
BUNNY_CDN_API_KEY=${apiKey || 'your-api-key-here'}

# CDN URLs
NEXT_PUBLIC_CDN_URL=https://${hostname}

# Site Configuration  
NEXT_PUBLIC_SITE_URL=https://re.podtards.com
NEXT_PUBLIC_API_URL=https://re.podtards.com/api

# Environment
NODE_ENV=development

# Optional: Custom Domain for Images
NEXT_PUBLIC_IMAGE_DOMAIN=re.podtards.com
`;

  const envPath = path.join(process.cwd(), '.env.local');
  
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Created .env.local file with your CDN configuration!');
    console.log('\nNext steps:');
    console.log('1. Restart your development server');
    console.log('2. Replace your Image components with CDNImage where needed');
    console.log('3. Test the CDN by checking network requests in browser dev tools');
  } catch (error) {
    console.error('❌ Error creating .env.local file:', error.message);
  }
  
  rl.close();
}

setupCDN().catch(console.error); 