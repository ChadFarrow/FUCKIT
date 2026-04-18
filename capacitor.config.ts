import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.stablekraft',
  appName: 'StableKraft',
  webDir: 'public',
  server: {
    url: 'https://stablekraft.app',
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#1f2937'
  }
};

export default config;
