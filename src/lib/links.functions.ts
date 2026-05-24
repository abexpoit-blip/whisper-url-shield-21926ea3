import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LinkRow = {
  id: string;
  user_id: string;
  short_code: string;
  title: string | null;
  clicks_count: number | null;
  bot_clicks_count: number | null;
  created_at: string;
  adsterra_url?: string | null;
  safe_url?: string | null;
  is_active?: boolean;
  destination_url?: string | null;
  adsterra_direct_link?: string | null;
  status?: string | null;
};

export type DashboardLink = ReturnType<typeof normalizeLink>;

function normalizeLink(row: LinkRow) {
  return {
    ...row,
    adsterra_url: row.adsterra_url ?? row.adsterra_direct_link ?? row.destination_url ?? "",
    safe_url: row.safe_url ?? row.destination_url ?? "https://sleepox.com/",
    is_active: row.is_active ?? row.status === "active",
  };
}

async function selectLinks(supabase: any): Promise<{ data: DashboardLink[] | null; error: { message: string } | null }> {
  const modern = await supabase.from("links").select("*").order("created_at", { ascending: false });
  if (!modern.error) return modern;
  const legacy = await supabase
    .from("links")
    .select("id, user_id, short_code, title, destination_url, adsterra_direct_link, status, clicks_count, bot_clicks_count, created_at, updated_at")
    .order("created_at", { ascending: false });
  return legacy.error ? modern : { data: (legacy.data ?? []).map((row: LinkRow) => normalizeLink(row)), error: null };
}

function randomCode(len = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const listMyLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await selectLinks(context.supabase);
    if (error) throw new Error(error.message);
    return data;
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

// Combined: one server-fn call = one auth round-trip = ~2x faster dashboard load
export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [linksRes, profileRes] = await Promise.all([
      selectLinks(context.supabase),
      context.supabase.from("profiles").select("*").eq("id", context.userId).single(),
    ]);
    if (linksRes.error) throw new Error(linksRes.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);
    return { links: linksRes.data, profile: profileRes.data };
  });

export const createLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().max(200).optional(),
      adsterra_url: z.string().url(),
      safe_url: z.string().url().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Quota check
    const { data: profile } = await context.supabase
      .from("profiles").select("link_limit, links_used").eq("id", context.userId).single();
    if (profile && profile.link_limit !== null && profile.links_used >= profile.link_limit) {
      throw new Error(`Link limit reached (${profile.links_used}/${profile.link_limit}). Please upgrade.`);
    }

    // Generate unique code
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await context.supabase
        .from("links").select("id").eq("short_code", code).maybeSingle();
      if (!exists) break;
      code = randomCode();
    }

    const createdModern = await context.supabase
      .from("links")
      .insert({
        user_id: context.userId,
        short_code: code,
        title: data.title ?? null,
        adsterra_url: data.adsterra_url,
        safe_url: data.safe_url ?? "https://sleepox.com/",
      })
      .select()
      .single();

    let link: unknown = createdModern.data;
    let error: { message: string } | null = createdModern.error;

    if (error) {
      const legacy = await context.supabase
        .from("links")
        .insert({
          user_id: context.userId,
          short_code: code,
          title: data.title ?? null,
          destination_url: data.safe_url ?? "https://sleepox.com/",
          adsterra_direct_link: data.adsterra_url,
          status: "active",
        } as never)
        .select()
        .single();
      link = legacy.data ? normalizeLink(legacy.data as LinkRow) : null;
      error = legacy.error;
    }
    if (error) throw new Error(error.message);

    await context.supabase
      .from("profiles")
      .update({ links_used: (profile?.links_used ?? 0) + 1 })
      .eq("id", context.userId);

    return link;
  });

export const deleteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: link, error: lookupError } = await context.supabase
      .from("links")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!link) throw new Error("Link not found");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("links_used")
      .eq("id", context.userId)
      .single();

    const { error } = await context.supabase.from("links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (profile) {
      await context.supabase
        .from("profiles")
        .update({ links_used: Math.max((profile.links_used || 0) - 1, 0) })
        .eq("id", context.userId);
    }
    return { ok: true };
  });

export const toggleLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const modern = await context.supabase
      .from("links").update({ is_active: data.is_active }).eq("id", data.id);
    const { error } = modern.error
      ? await context.supabase
          .from("links")
          .update({ status: data.is_active ? "active" : "paused" } as never)
          .eq("id", data.id)
      : modern;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
