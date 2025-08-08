#!/bin/bash

# Build script for DoerfelVerse TWA
echo "🎵 Building DoerfelVerse TWA APK..."

# Check if Android SDK is available
if [ -z "$ANDROID_HOME" ]; then
    echo "❌ ANDROID_HOME is not set. Please install Android SDK and set ANDROID_HOME."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Build the APK
echo "🔨 Building APK..."
./gradlew assembleRelease

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ APK built successfully!"
    echo "📱 APK location: app/build/outputs/apk/release/app-release.apk"
    echo "📏 APK size: $(du -h app/build/outputs/apk/release/app-release.apk | cut -f1)"
else
    echo "❌ Build failed!"
    exit 1
fi 