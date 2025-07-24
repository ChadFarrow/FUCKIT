#!/bin/bash

# Setup script to configure Git hooks for auto-versioning
echo "🔧 Setting up Git hooks for auto-versioning..."

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a Git repository. Please run this from the project root."
    exit 1
fi

# Configure Git to use our custom hooks directory
echo "📁 Configuring Git hooks directory..."
git config core.hooksPath .githooks

# Verify the setup
if [ $? -eq 0 ]; then
    echo "✅ Git hooks configured successfully!"
    echo "📋 Configured hooks:"
    ls -la .githooks/
    echo ""
    echo "🚀 Version will now auto-increment on every push to main branch"
    echo "📈 Version format: v1.XXX (increments by 0.001 each push)"
    echo ""
    echo "To test the version increment manually, run:"
    echo "  node scripts/increment-version.js"
else
    echo "❌ Failed to configure Git hooks"
    exit 1
fi