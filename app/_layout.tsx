import * as SplashScreen from "expo-splash-screen";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const first = segments[0];
    if (first === undefined) return;

    const inAuthGroup = first === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/sign-in");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [initialized, router, segments, session]);

  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync();
    }
  }, [initialized]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryProvider>
        <RootStack />
      </QueryProvider>
    </AuthProvider>
  );
}
