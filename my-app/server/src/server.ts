import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './api';
import { getEnv, getDatabaseUrl, isLocalEmbeddedPostgres } from './lib/env';

// Parse CLI arguments
const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  
  return {
    port: portIndex !== -1 ? parseInt(args[portIndex + 1]) : parseInt(getEnv('PORT', '8787')!),
  };
};

const { port } = parseCliArgs();

// Extract PostgreSQL port from DATABASE_URL if it's a local embedded postgres connection
const getPostgresPortFromDatabaseUrl = (): number => {
  const dbUrl = getDatabaseUrl();
  if (dbUrl && dbUrl.includes('localhost:')) {
    const match = dbUrl.match(/localhost:(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  }
  return 5433; // fallback default
};

const startServer = async () => {
  console.log(`🚀 Starting backend server on port ${port}`);
  
  if (!getDatabaseUrl() || isLocalEmbeddedPostgres()) {
    console.log('🔗 Using local database connection (expecting database server on dynamic port)');
  } else {
    console.log('🔗 Using external database connection');
  }

  serve({
    fetch: app.fetch,
    port,
  });
};

// Graceful shutdown
const shutdown = async () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer(); 