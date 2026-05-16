import {
  useAppStoreSync,
  useEnsureProfileEffect,
  useResetAppStoreOnSignOut,
} from "@/hooks/use-campus-queries";

/**
 * Runs inside the signed-in tab shell: ensures `public.users` exists and syncs Query → Zustand.
 */
export function AppDataBootstrap() {
  useEnsureProfileEffect();
  useAppStoreSync();
  useResetAppStoreOnSignOut();
  return null;
}
