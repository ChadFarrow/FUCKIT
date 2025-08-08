#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

console.log('🔧 Fixing pnpm build script permissions for embedded postgres...\n');

// List of embedded postgres packages that need build scripts
const embeddedPostgresPackages = [
  '@embedded-postgres/darwin-arm64',
  '@embedded-postgres/darwin-x64', 
  '@embedded-postgres/linux-arm64',
  '@embedded-postgres/linux-x64',
  '@embedded-postgres/win32-x64'
];

console.log('📦 Packages to fix:', embeddedPostgresPackages.join(', '));

// Strategy 1: Try pnpm rebuild (forces build scripts to run)
console.log('\n🔄 Strategy 1: Rebuilding packages...');
try {
  const rebuildCmd = `pnpm rebuild ${embeddedPostgresPackages.join(' ')}`;
  console.log(`Running: ${rebuildCmd}`);
  
  execSync(rebuildCmd, { 
    stdio: 'inherit',
    cwd: projectRoot 
  });
  console.log('✅ Successfully rebuilt embedded postgres packages');
  
} catch (rebuildError) {
  console.log('⚠️ Rebuild failed:', rebuildError.message);
  
  // Strategy 2: Try approve-builds
  console.log('\n🔄 Strategy 2: Approving build scripts...');
  try {
    const approveCmd = `pnpm approve-builds ${embeddedPostgresPackages.join(' ')}`;
    console.log(`Running: ${approveCmd}`);
    
    execSync(approveCmd, { 
      stdio: 'inherit',
      cwd: projectRoot 
    });
    console.log('✅ Successfully approved build scripts');
    
  } catch (approveError) {
    console.log('⚠️ Approve-builds failed:', approveError.message);
    
    // Strategy 3: Manual instructions
    console.log('\n📋 Manual fix required:');
    console.log('Run one of these commands:');
    console.log(`  pnpm rebuild ${embeddedPostgresPackages.join(' ')}`);
    console.log('  OR');
    console.log(`  pnpm approve-builds ${embeddedPostgresPackages.join(' ')}`);
    console.log('  OR');
    console.log('  pnpm approve-builds (to approve all)');
    
    process.exit(1);
  }
}

console.log('\n🎉 pnpm build script fix complete!');
console.log('💡 Now try running your embedded postgres setup again.'); 