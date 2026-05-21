import { createStart, createMiddleware } from "@tanstack/react-start";
import type { CustomFetch } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { supabase } from "@/integrations/supabase/client";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

async function getFreshAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  if (session && session.expires_at && session.expires_at * 1000 - Date.now() < 5 * 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      await supabase.auth.signOut();
      return {};
    }
    session = refreshed.data.session;
  }

  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

const ensureFreshSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const authHeader = await getFreshAuthHeader();
  const retryWithFreshToken: CustomFetch = async (url, init) => {
    const first = await fetch(url, init);
    const text = first.clone ? await first.clone().text().catch(() => "") : "";

    if (first.ok || !text.includes("Unauthorized: Invalid token")) return first;

    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) {
      await supabase.auth.signOut();
      return first;
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${refreshed.data.session.access_token}`);
    return fetch(url, { ...init, headers });
  };

  return next({ headers: authHeader, fetch: retryWithFreshToken });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [ensureFreshSupabaseAuth, attachSupabaseAuth],
}));
