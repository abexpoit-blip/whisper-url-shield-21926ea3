import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new Error("Please login again before payment. (no token)");
  return token;
}

export async function requirePaymentUser(request: Request) {
  const token = getBearerToken(request);

  // Verify the user's access token via the admin (service-role) client.
  // This avoids publishable-key / JWT signing-algorithm mismatches
  // (e.g. legacy HS256 publishable key vs new ES256 user tokens).
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user?.id) {
    console.warn("[plisio-create] auth user failed", { message: error?.message });
    throw new Error(`Please login again before payment. (${error?.message ?? "invalid token"})`);
  }

  return { supabase: supabaseAdmin, userId: data.user.id, user: data.user };
}
