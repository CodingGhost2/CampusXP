import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export async function fetchProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserRow | null> {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();

  if (error) throw error;
  return data;
}

/** Ensures a `public.users` row exists for the auth user (first app open after signup). */
export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<void> {
  const { data, error } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();

  if (error) throw error;
  if (data) return;

  const email = user.email ?? "";
  const { error: insertError } = await supabase.from("users").insert({
    id: user.id,
    email,
    xp: 0,
  });

  if (insertError) throw insertError;
}
