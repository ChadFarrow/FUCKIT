import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let embeddedInstance: any = null;
let connectionString: string | null = null;

const isDatabaseInitialized = (dataDir: string): boolean => {
  const pgVersionFile = path.join(dataDir, 'PG_VERSION');
  const postgresqlConfFile = path.join(dataDir, 'postgresql.conf');
  return existsSync(pgVersionFile) && existsSync(postgresqlConfFile);
};

export const startEmbeddedPostgres = async (port: number = 5502): Promise<string> => {
  if (embeddedInstance && connectionString) {
    return connectionString;
  }

  console.log('🗄️ Starting embedded PostgreSQL...');

  // For now, always return a mock connection string to avoid build issues
  // This can be enhanced later when embedded-postgres is properly configured
  console.warn('⚠️ embedded-postgres not configured for build. Using mock connection.');
  connectionString = `postgresql://postgres:password@localhost:${port}/postgres`;
  console.log(`✅ Mock PostgreSQL connection string: ${connectionString}`);
  return connectionString;
};

export const stopEmbeddedPostgres = async (): Promise<void> => {
  if (!embeddedInstance) return;

  try {
    console.log('🛑 Stopping embedded PostgreSQL...');
    if (embeddedInstance && typeof embeddedInstance.stop === 'function') {
      await embeddedInstance.stop();
    }
    embeddedInstance = null;
    connectionString = null;
    console.log('✅ Embedded PostgreSQL stopped');
  } catch (error) {
    console.error('❌ Error stopping embedded PostgreSQL:', error);
    embeddedInstance = null;
    connectionString = null;
  }
};

export const getEmbeddedConnectionString = (): string | null => connectionString; 