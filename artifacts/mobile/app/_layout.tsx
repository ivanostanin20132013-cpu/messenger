import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ActiveCallOverlay } from "@/components/ActiveCallOverlay";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { InAppNotification } from "@/components/InAppNotification";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CallProvider } from "@/context/CallContext";
import { PinLockProvider, usePinLock } from "@/context/PinLockContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { SocketProvider } from "@/context/SocketContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { token, isLoaded } = useAuth();
  const { locked } = usePinLock();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (locked) { router.replace("/pin-lock"); return; }
    const inAuth = segments[0] === "login";
    const inPin = segments[0] === "pin-lock";
    if (!token && !inAuth) { router.replace("/login"); return; }
    if (token && inAuth) { router.replace("/"); return; }
    if (token && !locked && inPin) { router.replace("/"); return; }
  }, [token, isLoaded, locked, segments]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="pin-lock" />
        <Stack.Screen name="settings" />
      </Stack>
      <IncomingCallModal />
      <ActiveCallOverlay />
      <InAppNotification />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <SettingsProvider>
                <AuthProvider>
                  <SocketProvider>
                    <PinLockProvider>
                      <CallProvider>
                        <RootLayoutNav />
                      </CallProvider>
                    </PinLockProvider>
                  </SocketProvider>
                </AuthProvider>
              </SettingsProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
