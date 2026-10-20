// Runtime configuration. Values prefixed EXPO_PUBLIC_ are inlined by the
// Expo bundler and are safe to expose in the client:
//  - the Supabase anon key is intended to be public; it is gated server-side
//    by Row-Level Security policies.
// Never put service-role keys or other secrets here.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  supabaseUrl: supabaseUrl ?? '',
  supabaseAnonKey: supabaseAnonKey ?? '',
  isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
};
