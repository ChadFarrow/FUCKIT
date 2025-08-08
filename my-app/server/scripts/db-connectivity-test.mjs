import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(connectionString, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 5
});

try {
  // Simple connectivity test
  await sql`SELECT 1 as test`;
  console.log('connected');
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
} finally {
  await sql.end();
} 