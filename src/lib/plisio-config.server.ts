export async function getPlisioApiKey(supabaseAdmin?: any): Promise<{ apiKey: string | null; source: "env" | "database" | null }> {
  const envKey = process.env.PLISIO_API_KEY?.trim();
  if (envKey) return { apiKey: envKey, source: "env" };

  const admin = supabaseAdmin ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data } = await (admin as any)
    .from("payment_settings")
    .select("plisio_api_key")
    .eq("id", 1)
    .maybeSingle();

  const dbKey = typeof data?.plisio_api_key === "string" ? data.plisio_api_key.trim() : "";
  return dbKey ? { apiKey: dbKey, source: "database" } : { apiKey: null, source: null };
}