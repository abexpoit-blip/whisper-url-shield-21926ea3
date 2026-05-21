import { supabase } from "@/integrations/supabase/client";

function isAuthTokenError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : String(error ?? "");
  return /Unauthorized: Invalid token|JWT expired|Invalid JWT/i.test(message);
}

export function isSupabaseAuthTokenError(error: unknown) {
  return isAuthTokenError(error);
}

export async function withFreshSupabaseAuth<T extends { error: { message?: string } | null }>(
  operation: () => PromiseLike<T>,
) {
  const first = await operation();
  if (!first.error || !isAuthTokenError(first.error)) return first;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") window.location.replace(`/login?redirect=${encodeURIComponent(window.location.href)}`);
    return { ...first, error: null } as T;
  }

  return operation();
}