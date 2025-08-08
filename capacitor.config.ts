import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.doerfelverse.app',
  appName: 'DoerfelVerse',
  webDir: '.next',
  server: {
    url: 'http://localhost:3000',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;
