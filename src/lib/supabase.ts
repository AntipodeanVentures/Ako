import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { env } from './env';

// The client is created lazily so the app still boots before Supabase
// credentials are configured (e.g. during early local development).
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!env.isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // On the web the password-reset and confirmation links land with a
        // code in the URL that the client exchanges for a session. On native
        // deep links are handled explicitly by the auth flow.
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    });
  }
  return client;
}
