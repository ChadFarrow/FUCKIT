#!/usr/bin/env node

/**
 * Periodic Firebase Emulator Backup Script
 * 
 * This script runs alongside the Firebase emulator and automatically exports
 * data every 60 seconds to prevent data loss during crashes or forced shutdowns.
 * 
 * Uses the Firebase Emulator Hub REST API to trigger exports while running.
 */

import { setTimeout as sleep } from 'timers/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_INTERVAL = 60000; // 60 seconds
const EMULATOR_HUB_PORT = 4400; // Default Firebase Emulator Hub port
const EXPORT_PATH = './data/firebase-emulator';

let backupCount = 0;
let isBackupRunning = false;

/**
 * Export emulator data via REST API
 */
async function exportEmulatorData() {
  if (isBackupRunning) {
    console.log('⏳ Backup already in progress, skipping...');
    return;
  }

  try {
    isBackupRunning = true;
    backupCount++;
    
    const response = await fetch(`http://localhost:${EMULATOR_HUB_PORT}/emulators/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: EXPORT_PATH
      }),
    });

    if (response.ok) {
      console.log(`💾 Emulator data backed up (#${backupCount}) - ${new Date().toISOString()}`);
    } else {
      console.warn(`⚠️  Backup failed (HTTP ${response.status}): ${response.statusText}`);
    }
  } catch (error) {
    // Don't log connection errors during startup - emulator might not be ready yet
    if (backupCount > 2) {
      console.warn(`⚠️  Backup failed: ${error.message}`);
    }
  } finally {
    isBackupRunning = false;
  }
}

/**
 * Check if emulator hub is running
 */
async function isEmulatorRunning() {
  try {
    const response = await fetch(`http://localhost:${EMULATOR_HUB_PORT}/emulators`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Main backup loop
 */
async function startPeriodicBackup() {
  console.log('🔄 Starting periodic Firebase emulator backup (every 60s)...');
  
  // Wait for emulator to be ready
  console.log('⏳ Waiting for Firebase emulator to start...');
  while (!(await isEmulatorRunning())) {
    await sleep(2000); // Check every 2 seconds
  }
  
  console.log('✅ Firebase emulator detected, starting periodic backups');
  
  // Start periodic backups
  while (true) {
    await exportEmulatorData();
    await sleep(BACKUP_INTERVAL);
  }
}

/**
 * Handle graceful shutdown
 */
function setupShutdownHandlers() {
  const shutdown = () => {
    console.log('\n🛑 Stopping periodic backup...');
    process.exit(0);
  };

  const signals = process.platform === 'win32' 
    ? ['SIGINT', 'SIGTERM', 'SIGBREAK']
    : ['SIGINT', 'SIGTERM'];
  
  signals.forEach(signal => {
    process.on(signal, shutdown);
  });
}

// Start the backup process
if (import.meta.url === `file://${process.argv[1]}`) {
  setupShutdownHandlers();
  startPeriodicBackup().catch((error) => {
    console.error('❌ Periodic backup failed:', error);
    process.exit(1);
  });
} 