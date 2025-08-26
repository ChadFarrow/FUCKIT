#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to check .env.local file
function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  console.log('🔍 Checking .env.local file...');
  
  // Check if file exists
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found');
    console.log('📝 Please create .env.local with required environment variables');
    console.log('💡 You can copy from .env.example if available');
    return false;
  }
  
  console.log('✅ .env.local file found');
  
  // Read and parse the file
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=');
      }
    }
  });
  
  // Define required variables for this project
  const requiredVars = [
    'PODCAST_INDEX_API_KEY',
    'PODCAST_INDEX_API_SECRET'
  ];
  
  const optionalVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY'
  ];
  
  console.log('\n📊 Environment Variables Status:');
  
  // Check required variables
  let allRequiredPresent = true;
  console.log('\n🔑 Required Variables:');
  requiredVars.forEach(varName => {
    if (envVars[varName]) {
      console.log(`✅ ${varName} - Present`);
    } else {
      console.log(`❌ ${varName} - Missing`);
      allRequiredPresent = false;
    }
  });
  
  // Check optional variables
  console.log('\n🔧 Optional Variables:');
  optionalVars.forEach(varName => {
    if (envVars[varName]) {
      console.log(`✅ ${varName} - Present`);
    } else {
      console.log(`⚠️  ${varName} - Not set (optional)`);
    }
  });
  
  // Show total count
  const totalVars = Object.keys(envVars).length;
  console.log(`\n📈 Total environment variables: ${totalVars}`);
  
  if (!allRequiredPresent) {
    console.log('\n⚠️  Some required environment variables are missing!');
    console.log('📝 Please add the missing variables to your .env.local file');
    return false;
  }
  
  console.log('\n✅ All required environment variables are present!');
  return true;
}

// Function to provide setup guidance
function provideSetupGuidance() {
  console.log('\n📚 Setup Guidance:');
  console.log('1. Create a .env.local file in your project root');
  console.log('2. Add your environment variables in KEY=value format');
  console.log('3. Make sure .env.local is in your .gitignore file');
  console.log('4. Restart your development server after changes');
  
  console.log('\n🔐 Security Tips:');
  console.log('- Never commit .env.local to version control');
  console.log('- Use different values for development and production');
  console.log('- Consider using environment-specific files (.env.development, .env.production)');
}

// Main execution
if (require.main === module) {
  const envOk = checkEnvFile();
  
  if (!envOk) {
    provideSetupGuidance();
    process.exit(1);
  }
}

module.exports = { checkEnvFile, provideSetupGuidance }; 