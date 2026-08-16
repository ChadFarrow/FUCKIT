#!/usr/bin/env node

// Validate .env.local against .env.example using dotenv-safe.
//
// .env.example is the single manifest: every uncommented key in it is required
// and must be non-empty. Commented keys are optional and invisible to this
// check. Keeping that contract honest is the point — a checker that demands
// variables the code never reads trains people to ignore it, which is what
// happened when this pointed at the old Bunny-CDN-era `env.example`.
//
// postinstall runs this behind `|| true`, so a fresh clone with no .env.local
// still installs cleanly. Run it directly to actually see the result.

const fs = require('fs');
const path = require('path');

const envLocal = path.resolve(process.cwd(), '.env.local');
const envExample = path.resolve(process.cwd(), '.env.example');

if (!fs.existsSync(envExample)) {
  console.error('❌ .env.example is missing — it is the manifest this check validates against.');
  process.exit(1);
}

// Absent .env.local is its own case. dotenv-safe reports it as every key being
// missing, which buries the one thing you need to know under a 20-key list.
if (!fs.existsSync(envLocal)) {
  console.error('❌ No .env.local found.\n');
  console.error('   cp .env.example .env.local   then fill in the required values.\n');
  console.error('   Required: DATABASE_URL, PODCAST_INDEX_API_KEY, PODCAST_INDEX_API_SECRET,');
  console.error('             SESSION_SECRET, ADMIN_SECRET');
  console.error('   Generate a secret: openssl rand -base64 48');
  process.exit(1);
}

try {
  require('dotenv-safe').config({
    allowEmptyValues: false,
    path: envLocal,
    example: envExample,
  });
  console.log('✅ Environment validated (.env.local vs .env.example)');
} catch (err) {
  const missing = err && Array.isArray(err.missing) ? err.missing : [];

  console.error('❌ Environment validation failed.\n');

  if (missing.length) {
    console.error('   Missing or empty in .env.local:');
    for (const key of missing) console.error(`     - ${key}`);

    // These two fail open rather than failing loudly, so an unset value ships a
    // disabled guard that still serves traffic. Worth saying out loud here.
    const failOpen = missing.filter((k) => k === 'SESSION_SECRET' || k === 'ADMIN_SECRET');
    if (failOpen.length) {
      const verb = failOpen.length > 1 ? 'fail' : 'fails';
      console.error(
        `\n   ⚠️  ${failOpen.join(' and ')} ${verb} OPEN when unset — the guard is`
      );
      console.error('      disabled, not the feature. Generate one: openssl rand -base64 48');
    }

    console.error('\n   Optional settings are commented out in .env.example; they are not');
    console.error('   required and will never appear in this list.');
  } else {
    console.error(`   ${err && err.message ? err.message : err}`);
  }

  process.exit(1);
}
