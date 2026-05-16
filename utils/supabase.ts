import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { env } from "@/utils/env";

let client: SupabaseClient<Database> | null = null;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Returns null when `EXPO_PUBLIC_SUPABASE_*` is missing/invalid (local setup). */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    const isWeb = Platform.OS === "web";
    const isBrowser = typeof window !== "undefined";
    const auth = isWeb
      ? {
          /**
           * Avoid AsyncStorage/localStorage access during web SSR (Node runtime).
           * Browser sessions still persist once hydration completes.
           */
          autoRefreshToken: isBrowser,
          persistSession: isBrowser,
          detectSessionInUrl: false,
        }
      : {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        };

    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth,
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseAnonKey && isValidHttpUrl(env.supabaseUrl));
}
