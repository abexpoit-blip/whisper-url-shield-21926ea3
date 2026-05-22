import { supabase } from "@/integrations/supabase/client";

const SUPPORTED_TOKEN_ALGORITHMS = new Set(["HS256", "ES256", "RS256"]);
const REFRESH_LOCK_KEY = "sleepox.auth.refresh.lock";
const REFRESH_LOCK_TTL_MS = 12_000;

let refreshPromise: Promise<string | null> | null = null;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function readRefreshLock() {
  try {
    return JSON.parse(window.localStorage.getItem(REFRESH_LOCK_KEY) ?? "{}") as { id?: string; expiresAt?: number };
  } catch {
    window.localStorage.removeItem(REFRESH_LOCK_KEY);
    return {};
  }
}

function decodeJwtPart(part: string) {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

export function tokenLooksUsable(token: string) {
  try {
    const [headerPart, payloadPart] = token.split(".");
    if (!headerPart || !payloadPart) return false;
    const header = decodeJwtPart(headerPart);
    return typeof header.alg === "string" && SUPPORTED_TOKEN_ALGORITHMS.has(header.alg);
  } catch {
    return false;
  }
}

export function safeRedirectPath(locationHref?: string | null) {
  if (typeof window === "undefined") return "/dashboard";
  if (!locationHref) return "/dashboard";

  try {
    const url = new URL(locationHref, window.location.origin);
    if (url.origin !== window.location.origin) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return locationHref.startsWith("/") && !locationHref.startsWith("//")
      ? locationHref
      : "/dashboard";
  }
}

export async function refreshSupabaseSessionOnce() {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(async () => {
      const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session?.access_token) return data.session.access_token;
        return supabase.auth.getSession().then(({ data: current }) => current.session?.access_token ?? null);
    }).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function withRefreshLock(operation: () => Promise<string | null>) {
  if (typeof window === "undefined") return operation();

  const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data: initial } = await supabase.auth.getSession();
  const initialToken = initial.session?.access_token ?? null;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const now = Date.now();
    const existing = readRefreshLock();

    if (!existing?.expiresAt || existing.expiresAt < now) {
      window.localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ id: lockId, expiresAt: now + REFRESH_LOCK_TTL_MS }));
      const confirmed = readRefreshLock();
      if (confirmed.id === lockId) {
        try {
          return await operation();
        } finally {
          const latest = readRefreshLock();
          if (latest.id === lockId) window.localStorage.removeItem(REFRESH_LOCK_KEY);
        }
      }
    }

    await wait(250);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token && token !== initialToken) return token;
  }

  return operation();
}

export function redirectToLoginPreservingPath() {
  if (typeof window === "undefined") return;
  const redirect = encodeURIComponent(safeRedirectPath(window.location.href));
  window.location.replace(`/login?redirect=${redirect}`);
}