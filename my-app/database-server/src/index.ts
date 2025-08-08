import { startEmbeddedPostgres, stopEmbeddedPostgres } from './embedded-postgres.js';

// Parse CLI arguments for port
const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  
  return {
    port: portIndex !== -1 ? parseInt(args[portIndex + 1]) : 5502,
  };
};

const { port } = parseCliArgs();

// Start database server
const startDatabaseServer = async () => {
  console.log('🚀 Starting volo-app Database Server...');
  
  try {
    // Start PostgreSQL
    await startEmbeddedPostgres(port);
    
  } catch (error) {
    console.error('❌ Failed to start database server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down database server...`);
  
  try {
    await stopEmbeddedPostgres();
    console.log('✅ Database server stopped gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
const signals = process.platform === 'win32' 
  ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const
  : ['SIGINT', 'SIGTERM'] as const;

signals.forEach(signal => {
  process.on(signal, () => shutdown(signal));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

// Start the server
startDatabaseServer(); 