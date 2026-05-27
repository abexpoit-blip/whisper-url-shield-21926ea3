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
  prelanding_template?: string | null;
};

type DashboardClick = {
  link_id: string;
  country: string | null;
  ua: string | null;
  user_agent?: string | null;
  ip: string | null;
  ip_address?: string | null;
  created_at: string;
  is_bot: boolean;
};

export type DashboardLink = ReturnType<typeof normalizeLink>;

function normalizeLink(row: LinkRow) {
  return {
    ...row,
    adsterra_url: row.adsterra_url ?? row.adsterra_direct_link ?? row.destination_url ?? "",
    safe_url: row.safe_url ?? (row.adsterra_direct_link ? row.destination_url : "https://sleepox.com/") ?? "https://sleepox.com/",
    is_active: row.is_active ?? row.status === "active",
  };
}

async function selectLinks(supabase: any): Promise<{ data: DashboardLink[] | null; error: { message: string } | null }> {
  const legacy = await supabase
    .from("links")
    .select("id, user_id, short_code, title, destination_url, adsterra_direct_link, status, clicks_count, bot_clicks_count, created_at, updated_at, prelanding_template")
    .order("created_at", { ascending: false });
  if (!legacy.error) return { data: (legacy.data ?? []).map((row: LinkRow) => normalizeLink(row)), error: null };
  const modern = await supabase.from("links").select("*").order("created_at", { ascending: false });
  return modern.error ? legacy : { data: (modern.data ?? []).map((row: LinkRow) => normalizeLink(row)), error: null };
}

async function getProfileQuota(supabase: any, userId: string) {
  const modern = await supabase
    .from("profiles")
    .select("link_limit, links_used")
    .eq("id", userId)
    .single();
  if (modern.error) return null;
  return { limit: modern.data?.link_limit ?? null, used: modern.data?.links_used ?? 0 };
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

// Combined: one server-fn call = links + profile + REAL click stats
export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [linksRes, profileRes] = await Promise.all([
      selectLinks(context.supabase),
      context.supabase.from("profiles").select("*").eq("id", context.userId).single(),
    ]);
    if (linksRes.error) throw new Error(linksRes.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);

    const links = linksRes.data ?? [];
    const linkIds = links.map((l) => l.id);

    const clicksByDay: Record<string, number> = {};
    const countryStats: Record<string, number> = {};
    const perLinkDaily: Record<string, number[]> = {};
    let mobileCount = 0;
    let totalForMobile = 0;
    const uniqueIps = new Set<string>();

    // init 30-day buckets
    for (let i = 29; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      clicksByDay[k] = 0;
    }
    for (const id of linkIds) perLinkDaily[id] = new Array(7).fill(0);

    if (linkIds.length > 0) {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const modern = await context.supabase
        .from("clicks")
        .select("link_id, country, ua, ip, created_at, is_bot")
        .in("link_id", linkIds)
        .gte("created_at", since)
        .eq("is_bot", false)
        .limit(50000);

      const legacy = modern.error
        ? await context.supabase
            .from("clicks")
            .select("link_id, country, user_agent, ip_address, created_at, is_bot")
            .in("link_id", linkIds)
            .gte("created_at", since)
            .eq("is_bot", false)
            .limit(50000)
        : { data: null };

      const clicks = ((modern.error ? legacy.data : modern.data) ?? []) as DashboardClick[];

      for (const c of clicks) {
        const created = c.created_at;
        const k = created.slice(0, 10);
        if (k in clicksByDay) clicksByDay[k]++;
        const country = c.country || "Unknown";
        countryStats[country] = (countryStats[country] ?? 0) + 1;
        const ua = c.ua || c.user_agent || "";
        totalForMobile++;
        if (/Mobile|Android|iPhone|iPad/i.test(ua)) mobileCount++;
        const ip = c.ip || c.ip_address;
        if (ip) uniqueIps.add(ip);
        const daysAgo = Math.floor((Date.now() - new Date(created).getTime()) / 86400000);
        if (daysAgo >= 0 && daysAgo < 7) {
          const arr = perLinkDaily[c.link_id];
          if (arr) arr[6 - daysAgo]++;
        }
      }
    }

    return {
      links,
      profile: profileRes.data,
      stats: {
        clicksByDay,
        countryStats,
        mobilePct: totalForMobile > 0 ? Math.round((mobileCount / totalForMobile) * 100) : 0,
        uniqueVisitors: uniqueIps.size,
        perLinkDaily,
      },
    };
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
    const profile = await getProfileQuota(context.supabase, context.userId);
    if (profile && profile.limit !== null && profile.used >= profile.limit) {
      throw new Error(`Link limit reached (${profile.used}/${profile.limit}). Please upgrade.`);
    }

    // Generate unique code
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await context.supabase
        .from("links").select("id").eq("short_code", code).maybeSingle();
      if (!exists) break;
      code = randomCode();
    }

    const createdLegacy = await context.supabase
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

    let link: DashboardLink | null = createdLegacy.data ? normalizeLink(createdLegacy.data as LinkRow) : null;
    let error: { message: string } | null = createdLegacy.error;

    if (error) {
      const modern = await context.supabase
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
      link = modern.data ? normalizeLink(modern.data as LinkRow) : null;
      error = modern.error;
    }
    if (error) throw new Error(error.message);

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

    const { error } = await context.supabase.from("links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const legacy = await context.supabase
      .from("links")
      .update({ status: data.is_active ? "active" : "paused" } as never)
      .eq("id", data.id);
    const { error } = legacy.error
      ? await context.supabase
          .from("links")
          .update({ is_active: data.is_active })
          .eq("id", data.id)
      : legacy;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TEMPLATE_VALUES = [
  "verify", "reward", "countdown", "article",
  "article_health", "article_news", "article_finance", "article_lifestyle",
  "article_tech", "article_celebrity", "article_business", "article_travel",
] as const;

export const updateLinkTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      prelanding_template: z.enum(TEMPLATE_VALUES),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("links")
      .update({ prelanding_template: data.prelanding_template })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
