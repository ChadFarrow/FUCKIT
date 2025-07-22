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
  console.log('🚀 Bunny.net CDN Setup for Next.js\n');
  
  console.log('To get your Bunny.net credentials:');
  console.log('1. Sign up at https://bunny.net/');
  console.log('2. Create a Pull Zone');
  console.log('3. Get your API key from the dashboard\n');
  
  const hostname = await question('Enter your CDN hostname (e.g., your-zone.b-cdn.net): ');
  const zone = await question('Enter your pull zone name (e.g., your-zone): ');
  const apiKey = await question('Enter your Bunny.net API key (optional, for purging): ');
  
  const envContent = `# Podcast Index API Credentials
# Get your API key and secret from https://api.podcastindex.org/
PODCAST_INDEX_API_KEY=your-api-key-here
PODCAST_INDEX_API_SECRET=your-api-secret-here

# Bunny.net CDN Configuration
# Get your CDN details from https://bunny.net/
BUNNY_CDN_HOSTNAME=${hostname}
BUNNY_CDN_ZONE=${zone}
BUNNY_CDN_API_KEY=${apiKey || 'your-api-key-here'}
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