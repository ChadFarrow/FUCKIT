#!/usr/bin/env node

/**
 * Setup private schema script
 * Creates the 'app' schema and sets proper permissions for security
 * This runs before Drizzle migrations to ensure tables are created in the private schema
 */

import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

console.log('🔒 Setting up private schema for secure database isolation...');

// Detect if this is a Neon database connection
const isNeonDatabase = (connectionString) => {
  return connectionString.includes('neon.tech') || connectionString.includes('neon.database');
};

// Detect if this is a Supabase database connection  
const isSupabaseDatabase = (connectionString) => {
  return connectionString.includes('supabase.co') || connectionString.includes('supabase.com') || connectionString.includes('pooler.supabase.com');
};

// Helper function to safely execute SQL with error handling
const safeExecute = async (sql, query, description, critical = false) => {
  try {
    await query;
    console.log(`   ✅ ${description}`);
    return true;
  } catch (error) {
    if (critical) {
      console.error(`   ❌ ${description}: ${error.message}`);
      throw error;
    } else {
      console.log(`   ⚠️  ${description}: ${error.message.split('\n')[0]} (non-critical, continuing...)`);
      return false;
    }
  }
};

// Helper function to check if a role exists
const roleExists = async (sql, roleName) => {
  try {
    const result = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${roleName}`;
    return result.length > 0;
  } catch (error) {
    console.log(`   ℹ️  Could not check if role "${roleName}" exists: ${error.message.split('\n')[0]}`);
    return false;
  }
};

const setupPrivateSchema = async () => {
  let sql;
  
  try {
    // Use consistent connection setup for all providers
    const client = postgres(connectionString, { 
      prepare: false,
      max: 1,
    });
    sql = client;

    // Create the private app schema (critical operation)
    console.log('📁 Creating private "app" schema...');
    await safeExecute(sql, sql`CREATE SCHEMA IF NOT EXISTS app`, 'Created app schema', true);
    
    // For Supabase specifically, ensure the app schema is not exposed via the Data API
    if (isSupabaseDatabase(connectionString)) {
      console.log('🔐 Configuring Supabase-specific security settings...');
      
      // Revoke public access to the app schema (critical)
      await safeExecute(sql, sql`REVOKE ALL ON SCHEMA app FROM PUBLIC`, 'Revoked PUBLIC access', true);
      
      // Check for Supabase-specific roles and revoke access if they exist
      const anonExists = await roleExists(sql, 'anon');
      const authenticatedExists = await roleExists(sql, 'authenticated');
      
      if (anonExists) {
        await safeExecute(sql, sql`REVOKE ALL ON SCHEMA app FROM anon`, 'Revoked anon role access');
      }
      
      if (authenticatedExists) {
        await safeExecute(sql, sql`REVOKE ALL ON SCHEMA app FROM authenticated`, 'Revoked authenticated role access');
        // Grant controlled access back to authenticated role for backend operations
        await safeExecute(sql, sql`GRANT USAGE ON SCHEMA app TO authenticated`, 'Granted USAGE to authenticated role');
        await safeExecute(sql, sql`GRANT CREATE ON SCHEMA app TO authenticated`, 'Granted CREATE to authenticated role');
      } else {
        console.log('   ℹ️  Supabase authenticated role not found - this might be a custom setup');
      }
      
      console.log('✅ Supabase Data API protection applied - app schema is not publicly exposed');
    } else {
      console.log('🔧 Configuring general PostgreSQL security settings...');
      
      // For other databases (like Neon), apply general security practices
      await safeExecute(sql, sql`REVOKE ALL ON SCHEMA app FROM PUBLIC`, 'Revoked PUBLIC access', true);
      
      // Grant permissions to the current user/role (critical for functionality)
      await safeExecute(sql, sql`GRANT ALL ON SCHEMA app TO CURRENT_USER`, 'Granted access to current user', true);
    }
    
    // Set default privileges for future tables in the app schema
    console.log('🛡️  Setting default privileges for future tables...');
    await safeExecute(sql, sql`ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC`, 'Set default table privileges');
    
    if (isSupabaseDatabase(connectionString)) {
      const authenticatedExists = await roleExists(sql, 'authenticated');
      if (authenticatedExists) {
        await safeExecute(sql, 
          sql`ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated`, 
          'Set default privileges for authenticated role'
        );
      }
    }
    
    console.log('✅ Private schema setup completed successfully!');
    console.log('');
    console.log('🔒 Security benefits:');
    console.log('   • Tables created in private "app" schema');
    console.log('   • Public access to schema revoked');
    if (isSupabaseDatabase(connectionString)) {
      console.log('   • No automatic API exposure (Supabase)');
    }
    console.log('   • Backend-only database access');
    
  } catch (error) {
    console.error('❌ Failed to setup private schema:', error.message);
    console.error('');
    console.error('💡 This might be due to:');
    console.error('   • Insufficient database permissions');
    console.error('   • Database connection issues');
    console.error('   • Provider-specific configuration differences');
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
    }
  }
};

setupPrivateSchema(); 