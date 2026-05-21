import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new Error("Please login again before payment. (no token)");
  return token;
}

function createTokenClient(token: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Payment auth is not configured on the server.");

  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function requirePaymentUser(request: Request) {
  const token = getBearerToken(request);
  const supabase = createTokenClient(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.id) {
    console.warn("[plisio-create] auth user failed", { message: error?.message });
    throw new Error(`Please login again before payment. (${error?.message ?? "invalid token"})`);
  }

  return { supabase, userId: data.user.id, user: data.user };
}