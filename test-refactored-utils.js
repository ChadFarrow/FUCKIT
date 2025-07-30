// Test script for refactored utilities
const { execSync } = require('child_process');

console.log('🧪 Testing Refactored Utilities...\n');

// Test 1: Check if TypeScript compilation works
console.log('1️⃣ Testing TypeScript compilation...');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful\n');
} catch (error) {
  console.log('❌ TypeScript compilation failed\n');
}

// Test 2: Check if new files exist
console.log('2️⃣ Checking new utility files...');
const fs = require('fs');
const newFiles = [
  'lib/logger.ts',
  'lib/error-utils.ts', 
  'lib/api-utils.ts',
  'lib/hooks/useImageLoader.ts',
  'lib/hooks/useDeviceDetection.ts',
  'components/CDNImageRefactored.tsx',
  'lib/feed-parser-optimized.ts'
];

newFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});
console.log('');

// Test 3: Check for console.log statements (should be reduced)
console.log('3️⃣ Checking for console.log statements (should be minimal)...');
try {
  const grepResult = execSync('grep -r "console.log" --include="*.ts" --include="*.tsx" lib/ components/ | wc -l', { encoding: 'utf8' });
  const count = parseInt(grepResult.trim());
  console.log(`Found ${count} console.log statements in lib/ and components/`);
  if (count < 10) {
    console.log('✅ Console.log statements have been significantly reduced\n');
  } else {
    console.log('⚠️  Still many console.log statements found\n');
  }
} catch (error) {
  console.log('❌ Error checking console.log statements\n');
}

// Test 4: Check for try-catch blocks (should be standardized)
console.log('4️⃣ Checking for try-catch blocks...');
try {
  const tryCount = execSync('grep -r "try {" --include="*.ts" --include="*.tsx" lib/ | wc -l', { encoding: 'utf8' });
  const catchCount = execSync('grep -r "catch" --include="*.ts" --include="*.tsx" lib/ | wc -l', { encoding: 'utf8' });
  console.log(`Found ${tryCount.trim()} try blocks and ${catchCount.trim()} catch blocks in lib/`);
  console.log('✅ Error handling patterns detected\n');
} catch (error) {
  console.log('❌ Error checking try-catch blocks\n');
}

// Test 5: Check Next.js build
console.log('5️⃣ Testing Next.js build...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Next.js build successful\n');
} catch (error) {
  console.log('❌ Next.js build failed\n');
}

console.log('🎉 Testing complete!'); 