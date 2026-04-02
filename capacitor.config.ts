import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.lyta.crm',
  appName: 'LYTA CRM',
  webDir: 'dist',
  server: {
    // Use local assets instead of streaming from remote
    // url: 'https://app.lyta.ch', // uncomment for live reload during dev
    cleartext: false,
  }
};

export default config;
