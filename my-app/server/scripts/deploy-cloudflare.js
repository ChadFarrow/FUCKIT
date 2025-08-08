#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function checkWranglerCli() {
  try {
    execSync('wrangler --version', { stdio: 'pipe' });
    logSuccess('Wrangler CLI is available');
    return true;
  } catch (error) {
    logError('Wrangler CLI is not installed');
    logInfo('To install Wrangler CLI, run:');
    logInfo('  npm install -g wrangler');
    logInfo('  OR');
    logInfo('  pnpm add -g wrangler');
    return false;
  }
}

async function parseEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!await fs.pathExists(envPath)) {
    logError('.env file not found');
    logInfo('Make sure you have a .env file in the server directory');
    return null;
  }

  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    const envVars = {};
    
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envVars[key] = value;
        }
      }
    }
    
    return envVars;
  } catch (error) {
    logError(`Failed to parse .env file: ${error.message}`);
    return null;
  }
}

async function validateDatabase(envVars) {
  const databaseUrl = envVars.DATABASE_URL;
  
  if (!databaseUrl) {
    logError('DATABASE_URL not found in .env file');
    return false;
  }

  // Check if using embedded PostgreSQL (local development database)
  const usingLocalDb = databaseUrl.includes('localhost:5433') || 
                      databaseUrl.includes('127.0.0.1:5433') || 
                      databaseUrl.includes('file:') || 
                      databaseUrl === 'memory://';

  if (usingLocalDb) {
    logError('Cannot deploy to Cloudflare with local embedded PostgreSQL database');
    logWarning('Embedded PostgreSQL is designed for local development only.');
    logInfo('For production deployment, you need a cloud PostgreSQL database.');
    logInfo('');
    logInfo('Recommended options:');
    logInfo('  1. Neon (free tier available): https://neon.tech');
    logInfo('  2. Supabase (free tier available): https://supabase.com');
    logInfo('  3. Remote PostgreSQL instance');
    logInfo('');
    logInfo('Update your DATABASE_URL in the .env file with a valid cloud PostgreSQL connection string.');
    return false;
  }

  // Validate PostgreSQL URL format
  if (!databaseUrl.startsWith('postgres')) {
    logError(`Invalid PostgreSQL URL format: ${databaseUrl}`);
    logInfo('DATABASE_URL should be a valid PostgreSQL connection string starting with "postgres://" or "postgresql://"');
    return false;
  }

  logSuccess('Database configuration is valid');
  return true;
}

async function generatePlatformConfig(envVars) {
  try {
    // Generate wrangler.toml from template
    const wranglerTemplatePath = path.join(process.cwd(), 'platforms', 'cloudflare', 'wrangler.toml.template');
    const wranglerOutputPath = path.join(process.cwd(), 'wrangler.toml');
    
    if (await fs.pathExists(wranglerTemplatePath)) {
      let content = await fs.readFile(wranglerTemplatePath, 'utf-8');
      
      // Replace placeholders
      for (const [key, value] of Object.entries(envVars)) {
        const placeholder = `{{${key}}}`;
        content = content.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      }
      
      await fs.writeFile(wranglerOutputPath, content, 'utf-8');
      logSuccess('Generated wrangler.toml from platform template');
    } else {
      logWarning('wrangler.toml.template not found, skipping');
    }

    // Generate .dev.vars with ALL environment variables from .env
    const devVarsOutputPath = path.join(process.cwd(), '.dev.vars');
    
    // Create .dev.vars content with all environment variables
    let devVarsContent = '# Cloudflare Workers development environment variables\n';
    devVarsContent += '# Auto-generated from .env during deployment\n\n';
    
    // Add all environment variables from .env
    for (const [key, value] of Object.entries(envVars)) {
      devVarsContent += `${key}=${value}\n`;
    }
    
    await fs.writeFile(devVarsOutputPath, devVarsContent, 'utf-8');
    logSuccess(`Generated .dev.vars with ${Object.keys(envVars).length} environment variables`);

  } catch (error) {
    logError(`Failed to generate platform configuration: ${error.message}`);
    throw error;
  }
}

async function deployToCloudflare() {
  try {
    // Check if wrangler.toml was generated
    const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
    if (!await fs.pathExists(wranglerPath)) {
      logError('wrangler.toml not found. Platform configuration may have failed.');
      return false;
    }

    logInfo('Deploying to Cloudflare Workers...');
    
    // Run wrangler deploy
    execSync('wrangler deploy', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    logSuccess('Successfully deployed to Cloudflare Workers!');
    return true;
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    return false;
  }
}

async function main() {
  log('🚀 Starting Cloudflare Workers deployment...', 'bold');
  
  try {
    // Step 1: Check prerequisites
    logInfo('Checking deployment prerequisites...');
    const wranglerAvailable = await checkWranglerCli();
    if (!wranglerAvailable) {
      process.exit(1);
    }

    // Step 2: Parse environment variables
    logInfo('Parsing environment variables...');
    const envVars = await parseEnvFile();
    if (!envVars) {
      process.exit(1);
    }

    // Step 3: Validate database configuration
    logInfo('Validating database configuration...');
    const dbValid = await validateDatabase(envVars);
    if (!dbValid) {
      process.exit(1);
    }

    // Step 4: Generate platform configuration
    logInfo('Preparing platform configuration...');
    await generatePlatformConfig(envVars);

    // Step 5: Deploy
    const deploySuccess = await deployToCloudflare();
    if (!deploySuccess) {
      process.exit(1);
    }

    log('🎉 Deployment completed successfully!', 'green');
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the deployment
main(); 