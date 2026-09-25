// RATED — Expo store wrapper (WebView → production site).
// Build: from mobile/, after `npx expo login` and `eas init`:
//   npx eas-cli build --platform all --profile production
const DEFAULT_RATED_URL = 'https://rated-aronvasolli12-6438.vercel.app';

export default {
  expo: {
    name: 'RATED',
    slug: 'rated',
    scheme: 'rated',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.rated.hiphop',
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
      },
    },
    android: {
      package: 'com.rated.hiphop',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      predictiveBackGestureEnabled: false,
    },
    extra: {
      ratedUrl: process.env.EXPO_PUBLIC_RATED_URL || DEFAULT_RATED_URL,
    },
  },
};
