# DoerfelVerse TWA (Trusted Web Activity)

This is the Android app wrapper for the DoerfelVerse music hub, built as a Trusted Web Activity (TWA) that wraps the Progressive Web App.

## 🎵 What is DoerfelVerse?

DoerfelVerse is a music and podcast hub featuring content from the Doerfel family and friends. This TWA provides a native Android app experience while using the existing web application.

## 📱 Features

- **Native App Experience**: Looks and feels like a native Android app
- **Offline Support**: PWA caching for offline music playback
- **Background Audio**: Audio continues playing when app is minimized
- **App Store Distribution**: Can be published to Google Play Store
- **Deep Linking**: Direct links to albums and tracks
- **Push Notifications**: (Future enhancement)

## 🛠️ Prerequisites

To build this TWA, you need:

1. **Android Studio** (recommended) or Android SDK
2. **Java Development Kit (JDK)** 8 or higher
3. **Gradle** (included with Android Studio)

## 🔧 Setup Instructions

### Option 1: Using Android Studio (Recommended)

1. **Open Android Studio**
2. **Open the `android-twa` folder** as a project
3. **Sync Gradle** when prompted
4. **Build the project** using Build → Make Project

### Option 2: Using Command Line

1. **Set ANDROID_HOME environment variable**:
   ```bash
   export ANDROID_HOME=/path/to/your/android/sdk
   ```

2. **Build the APK**:
   ```bash
   cd android-twa
   ./build-apk.sh
   ```

   Or manually:
   ```bash
   cd android-twa
   ./gradlew assembleRelease
   ```

## 📦 Build Output

The APK will be generated at:
```
android-twa/app/build/outputs/apk/release/app-release.apk
```

## 🚀 Publishing to Google Play Store

### 1. Sign the APK

Before publishing, you need to sign the APK with a release key:

```bash
# Generate a keystore (if you don't have one)
keytool -genkey -v -keystore doerfelverse-release-key.keystore -alias doerfelverse -keyalg RSA -keysize 2048 -validity 10000

# Sign the APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore doerfelverse-release-key.keystore app-release-unsigned.apk doerfelverse

# Optimize the APK
zipalign -v 4 app-release-unsigned.apk DoerfelVerse-release.apk
```

### 2. Google Play Console

1. **Create a developer account** at [Google Play Console](https://play.google.com/console)
2. **Create a new app** with package name `com.doerfelverse.twa`
3. **Upload the signed APK**
4. **Fill in app details**:
   - App name: DoerfelVerse
   - Short description: Music and podcast hub from the Doerfel family and friends
   - Full description: [Your detailed description]
   - Category: Music & Audio
   - Content rating: All ages
5. **Add screenshots** and **feature graphic**
6. **Submit for review**

## 🔄 Updating the App

When you update the web app:

1. **Deploy the web app** to production
2. **Update the version code** in `app/build.gradle`:
   ```gradle
   versionCode 2  // Increment this
   versionName "1.1"  // Update this
   ```
3. **Build and sign** the new APK
4. **Upload to Google Play Console**

## 🎨 Customization

### App Icon
Replace the icons in the `mipmap-*` folders with your custom icons.

### App Name
Update `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">Your App Name</string>
```

### Colors
Update `app/src/main/res/values/colors.xml` to match your brand colors.

### Web URL
Update the URL in `AndroidManifest.xml`:
```xml
<meta-data
    android:name="android.support.customtabs.trusted.DEFAULT_URL"
    android:value="https://your-domain.com" />
```

## 🐛 Troubleshooting

### Build Errors

1. **SDK not found**: Make sure `ANDROID_HOME` is set correctly
2. **Gradle sync failed**: Try File → Invalidate Caches and Restart in Android Studio
3. **Missing dependencies**: Run `./gradlew --refresh-dependencies`

### Runtime Issues

1. **App not loading**: Check that the web app is accessible at the configured URL
2. **Audio not working**: Ensure the web app has proper audio permissions
3. **Offline not working**: Verify PWA service worker is properly configured

## 📚 Resources

- [Trusted Web Activity Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Progressive Web Apps](https://web.dev/progressive-web-apps/)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)

## 🤝 Contributing

This TWA is part of the DoerfelVerse project. For web app changes, see the main project documentation.

## 📄 License

Same license as the main DoerfelVerse project. 