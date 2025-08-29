import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PodcastIndexRSSParser from './rss-feed-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvConfig() {
  const envPath = path.join(__dirname, '../../.env.local');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local file not found. Please create it with PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        config[key.trim()] = value.trim();
      }
    }
  });
  
  if (!config.PODCAST_INDEX_API_KEY || !config.PODCAST_INDEX_API_SECRET) {
    throw new Error('PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET must be set in .env.local');
  }
  
  return config;
}

export function createRSSParser() {
  const config = loadEnvConfig();
  return new PodcastIndexRSSParser(
    config.PODCAST_INDEX_API_KEY,
    config.PODCAST_INDEX_API_SECRET
  );
}

export { PodcastIndexRSSParser };