import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SUPPORTED_TOKEN_ALGORITHMS = new Set(["HS256", "ES256", "RS256"]);

function decodeJwtPart(part: string) {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function tokenMatchesCurrentProject(token: string) {
  // Self-host friendly: only validate that the JWT is structurally valid and
  // uses a supported algorithm. The Supabase server itself authoritatively
  // validates the token on every request — we don't need to pin issuer here.
  try {
    const [headerPart, payloadPart] = token.split(".");
    if (!headerPart || !payloadPart) return false;
    const header = decodeJwtPart(headerPart);
    return typeof header.alg === "string" && SUPPORTED_TOKEN_ALGORITHMS.has(header.alg);
  } catch {
    return false;
  }
}

function safeRedirectPath(locationHref: string) {
  try {
    const url = new URL(locationHref, window.location.origin);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return locationHref.startsWith("/") && !locationHref.startsWith("//")
      ? locationHref
      : "/dashboard";
  }
}

export async function getVerifiedClientSession() {
  if (typeof window === "undefined") return null;

  let { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) return null;
  if (!tokenMatchesCurrentProject(sessionData.session.access_token)) {
    await supabase.auth.signOut();
    return null;
  }

  let { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return { session: sessionData.session, user: data.user };

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) return null;

  sessionData = refreshed.data;
  ({ data, error } = await supabase.auth.getUser());
  if (error || !data.user) return null;

  return { session: sessionData.session, user: data.user };
}

export async function requireClientUser(locationHref: string) {
  if (typeof window === "undefined") return;

  const verified = await getVerifiedClientSession();
  if (verified) return;

  await supabase.auth.signOut();
  throw redirect({ to: "/login", search: { redirect: safeRedirectPath(locationHref) } });
}

export async function requireClientAdmin() {
  if (typeof window === "undefined") return;

  let { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      ({ data, error } = await supabase.auth.getUser());
    }
  }

  if (error || !data.user) {
    await supabase.auth.signOut();
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
