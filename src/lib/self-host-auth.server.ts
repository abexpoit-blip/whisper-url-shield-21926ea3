import { createMiddleware, getGlobalStartContext } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type AuthRequestContext = { authHeader?: string };

function bearerFromAuthHeader(authHeader: string) {
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new Error("Your session is loading. Please refresh once.");
  return token;
}

function bearerFromCurrentRequest() {
  const context = getGlobalStartContext() as AuthRequestContext | undefined;
  return bearerFromAuthHeader(context?.authHeader ?? "");
}

function createUserScopedClient(token: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Backend auth environment is missing on the VPS.");

  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const requireSelfHostedAuth = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const token = bearerFromAuthHeader(((context as unknown as AuthRequestContext).authHeader) ?? "");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user?.id) {
      throw new Error(`Your session expired. Please sign in again. (${error?.message ?? "invalid token"})`);
    }

    return next({
      context: {
        supabase: createUserScopedClient(token),
        userId: data.user.id,
        user: data.user,
        claims: { sub: data.user.id, email: data.user.email ?? null },
      },
    });
  },
);

export async function requireSelfHostedUser() {
  const token = bearerFromCurrentRequest();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new Error(`Your session expired. Please sign in again. (${error?.message ?? "invalid token"})`);
  }
  return { userId: data.user.id, user: data.user, supabase: supabaseAdmin };
}

export async function requireSelfHostedAdmin() {
  const auth = await requireSelfHostedUser();
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: auth.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
  return auth;
}