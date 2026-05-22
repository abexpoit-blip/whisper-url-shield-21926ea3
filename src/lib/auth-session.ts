import { supabase } from "@/integrations/supabase/client";

const SUPPORTED_TOKEN_ALGORITHMS = new Set(["HS256", "ES256", "RS256"]);
const REFRESH_LOCK_KEY = "sleepox.auth.refresh.lock";
const REFRESH_LOCK_TTL_MS = 12_000;
const SESSION_RESTORE_WAIT_MS = 10_000;
const TOKEN_REFRESH_SKEW_MS = 5_000;
const SHORT_SESSION_RESTORE_WAIT_MS = 1_500;

let refreshPromise: Promise<string | null> | null = null;
let restorePromise: Promise<string | null> | null = null;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
export const tokenExpiryMs = (token: string) => {
  try {
    const payload = decodeJwtPart(token.split(".")[1] ?? "");
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

export function tokenHasTimeLeft(token: string, minMs = TOKEN_REFRESH_SKEW_MS) {
  return tokenLooksUsable(token) && tokenExpiryMs(token) > Date.now() + minMs;
}

export function isAuthStorageError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return /refresh_token_already_used|Invalid Refresh Token|Refresh Token Not Found|Auth session missing|session_not_found/i.test(
    message,
  );
}

function readRefreshLock() {
  try {
    return JSON.parse(window.localStorage.getItem(REFRESH_LOCK_KEY) ?? "{}") as {
      id?: string;
      expiresAt?: number;
    };
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

export async function refreshSupabaseSessionOnce(options: { force?: boolean } = {}) {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(async () => {
      const { data: current } = await supabase.auth.getSession();
      const currentToken = current.session?.access_token ?? null;
      if (currentToken && !options.force && tokenHasTimeLeft(currentToken)) {
        return currentToken;
      }

      const restoredBeforeRefresh = await waitForStoredSession(
        currentToken,
        options.force ? 600 : SHORT_SESSION_RESTORE_WAIT_MS,
      );
      if (restoredBeforeRefresh) return restoredBeforeRefresh;

      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session?.access_token) return data.session.access_token;

      const { data: after } = await supabase.auth.getSession();
      const afterToken = after.session?.access_token ?? null;
      if (afterToken && tokenHasTimeLeft(afterToken)) return afterToken;

      if (error && !isAuthStorageError(error)) return null;
      return waitForStoredSession(currentToken, 2_000);
    }, options.force ?? false).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function withRefreshLock(operation: () => Promise<string | null>, force = false) {
  if (typeof window === "undefined") return operation();

  const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data: initial } = await supabase.auth.getSession();
  const initialToken = initial.session?.access_token ?? null;
  if (!force && initialToken && tokenHasTimeLeft(initialToken)) return initialToken;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const now = Date.now();
    const existing = readRefreshLock();

    if (!existing?.expiresAt || existing.expiresAt < now) {
      window.localStorage.setItem(
        REFRESH_LOCK_KEY,
        JSON.stringify({ id: lockId, expiresAt: now + REFRESH_LOCK_TTL_MS }),
      );
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

    const token = await waitForStoredSession(initialToken, 250);
    if (token) return token;
  }

  return operation();
}

export async function waitForStoredSession(
  previousToken?: string | null,
  timeoutMs = SESSION_RESTORE_WAIT_MS,
) {
  if (typeof window === "undefined") return null;

  const startedAt = Date.now();
  if (!restorePromise) {
    restorePromise = new Promise<string | null>((resolve) => {
      let settled = false;
      let timeoutId: number | null = null;
      let subscription: { unsubscribe: () => void } | null = null;

      const finish = (token: string | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        subscription?.unsubscribe();
        resolve(token);
      };

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const token = session?.access_token ?? null;
        if (token && token !== previousToken) finish(token);
      });
      subscription = data.subscription;

      const poll = async () => {
        while (!settled && Date.now() - startedAt < timeoutMs) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? null;
          if (token && token !== previousToken) return finish(token);
          await wait(250);
        }
        finish(null);
      };

      timeoutId = window.setTimeout(() => finish(null), timeoutMs);
      void poll();
    }).finally(() => {
      restorePromise = null;
    });
  }

  return restorePromise;
}

export function redirectToLoginPreservingPath() {
  if (typeof window === "undefined") return;
  const redirect = encodeURIComponent(safeRedirectPath(window.location.href));
  window.location.replace(`/login?redirect=${redirect}`);
}
