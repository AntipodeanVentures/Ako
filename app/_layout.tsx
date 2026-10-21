import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from '@expo-google-fonts/instrument-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/src/features/auth';
import { ProfileProvider, useProfile } from '@/src/features/profile';
import { useSubjects } from '@/src/features/subjects';
import { queryClient } from '@/src/lib/queryClient';
import { ThemeProvider, useTheme } from '@/src/theme';

// Hold the native splash screen until the brand fonts are ready, so the
// app never flashes a system-font frame.
SplashScreen.preventAutoHideAsync();

// Redirects the user to the right section depending on whether they are
// signed in, have a profile, and have started a subject. The same shape
// as Thrive's guard, with Ako's states.
function useRouteGuard() {
  const { session, loading: authLoading, configured } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const subjects = useSubjects();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!configured || authLoading || profileLoading) return;
    if (session && subjects.isLoading) return;

    const group = segments[0];
    // Development only: fixture-rendered screens for layout checks (app/preview.tsx).
    if (__DEV__ && group === 'preview') return;
    // The reset link signs the learner in and must stay on its own screen.
    if (group === '(auth)' && segments[1] === 'reset-password') return;
    if (!session) {
      if (group !== '(auth)') router.replace('/sign-in');
    } else if (!profile || !(subjects.data && subjects.data.length)) {
      // First run: straight to the goal question. The account already
      // exists, so nothing is lost if they stop here.
      if (group !== '(onboarding)') router.replace('/goal');
    } else if (group !== '(app)' && group !== '(onboarding)') {
      router.replace('/learn');
    }
  }, [
    configured,
    session,
    profile,
    subjects.data,
    subjects.isLoading,
    authLoading,
    profileLoading,
    segments,
    router,
  ]);
}

function RootNavigator() {
  const { colors, mode } = useTheme();
  useRouteGuard();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  // If the font fetch fails or stalls (a cut-off dev-server response on web, say),
  // draw anyway in the system font rather than leaving a blank screen.
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedLongEnough(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const ready = fontsLoaded || Boolean(fontError) || waitedLongEnough;

  useEffect(() => {
    if (fontError) console.warn('Ako: font load failed, using the system font', fontError);
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ProfileProvider>
                <RootNavigator />
              </ProfileProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
