import type { ExpoConfig } from "expo/config";

/**
 * Campus XP — static Expo config (Phase 0).
 *
 * Secrets never belong in this file. Use environment variables prefixed with
 * `EXPO_PUBLIC_` so Metro inlines them at build time (see `.env.example` and `utils/env.ts`).
 * Optional server-only keys belong in Supabase Edge Functions, not the client.
 */
const config: ExpoConfig = {
  name: "Campus-XP",
  slug: "Campus-XP",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "campusxp",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
