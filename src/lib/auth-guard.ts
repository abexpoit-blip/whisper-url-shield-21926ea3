import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  refreshSupabaseSessionOnce,
  safeRedirectPath,
  tokenHasTimeLeft,
  tokenLooksUsable,
  waitForStoredSession,
} from "@/lib/auth-session";

export async function getVerifiedClientSession() {
  if (typeof window === "undefined") return null;

  let { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    const restoredToken = await waitForStoredSession(null, 12_000);
    if (!restoredToken) return null;
    ({ data: sessionData } = await supabase.auth.getSession());
  }
  if (!sessionData.session?.access_token) return null;
  if (!tokenLooksUsable(sessionData.session.access_token)) {
    return null;
  }

  if (tokenHasTimeLeft(sessionData.session.access_token)) {
    return { session: sessionData.session, user: sessionData.session.user };
  }

  let { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return { session: sessionData.session, user: data.user };

  const accessToken = await refreshSupabaseSessionOnce({ force: true });
  if (!accessToken) return null;

  ({ data: sessionData } = await supabase.auth.getSession());
  if (!sessionData.session?.access_token) return null;
  ({ data, error } = await supabase.auth.getUser());
  if (error || !data.user) return null;

  return { session: sessionData.session, user: data.user };
}

export async function requireClientUser(locationHref: string) {
  if (typeof window === "undefined") return;

  const verified = await getVerifiedClientSession();
  if (verified) return;

  throw redirect({ to: "/login", search: { redirect: safeRedirectPath(locationHref) } });
}

export async function requireClientAdmin() {
  if (typeof window === "undefined") return;

  let { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const accessToken = await refreshSupabaseSessionOnce({ force: true });
    if (accessToken) {
      ({ data, error } = await supabase.auth.getUser());
    }
  }

  if (error || !data.user) {
    throw redirect({ to: "/control-panel" });
  }

  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !role) throw redirect({ to: "/dashboard" });
}
