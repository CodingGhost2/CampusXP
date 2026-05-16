/**
 * Typed access to public env vars (EXPO_PUBLIC_*).
 * Phase 1+ validates non-empty values before Supabase client init.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  storageBucket: process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "task-proofs",
  /** Optional: Edge Function or proxy URL — never ship provider API keys as `EXPO_PUBLIC_*`. */
  aiGatewayUrl: process.env.EXPO_PUBLIC_AI_GATEWAY_URL ?? "",
} as const;
