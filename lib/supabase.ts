import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/** Avoid AsyncStorage during Node/SSR (EAS server export has no `window`). */
const isServer = typeof window === 'undefined';

const memoryStorage: SupportedStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? memoryStorage : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});
