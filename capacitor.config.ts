import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.2f92381f7141498ab964501c3ef0337c',
  appName: 'viewi',
  webDir: 'dist',
  server: {
    url: 'https://2f92381f-7141-498a-b964-501c3ef0337c.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    NativeBiometric: {
      faceIdDescription: 'Use Face ID to sign in quickly and securely'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
