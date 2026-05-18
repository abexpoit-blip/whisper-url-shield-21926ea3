import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RangeSchema = z.object({
  days: z.number().int().min(1).max(90).default(7),
  linkId: z.string().uuid().optional().nullable(),
});

type Click = {
  link_id: string;
  is_bot: boolean;
  country: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  variant: string | null;
  bot_reason: string | null;
  referer: string | null;
  created_at: string;
};

function bucket<T extends string | null | undefined>(rows: Click[], key: (c: Click) => T) {
  const map = new Map<string, { total: number; bots: number; humans: number }>();
  for (const c of rows) {
    const k = (key(c) ?? "unknown") as string;
    const e = map.get(k) ?? { total: 0, bots: 0, humans: 0 };
    e.total += 1;
    if (c.is_bot) e.bots += 1; else e.humans += 1;
    map.set(k, e);
  }
  return [...map.entries()]
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.total - a.total);
}

export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 24 * 3600 * 1000).toISOString();

    // Get user's links first (RLS scoped)
    let linksQ = supabase.from("links").select("id, short_code, title, destination_url, clicks_count, bot_clicks_count");
    if (data.linkId) linksQ = linksQ.eq("id", data.linkId);
    const { data: links } = await linksQ;
    const linkIds = (links ?? []).map((l) => l.id);
    if (linkIds.length === 0) {
      return {
        totals: { total: 0, humans: 0, bots: 0, conversionRate: 0 },
        timeseries: [],
        topReasons: [],
        byCountry: [],
        byDevice: [],
        byBrowser: [],
        byOS: [],
        byVariant: [],
        byLink: [],
        referrers: [],
        links: [],
      };
    }

    const { data: clicksRaw } = await supabase
      .from("clicks")
      .select("link_id,is_bot,country,device,os,browser,variant,bot_reason,referer,created_at")
      .in("link_id", linkIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);

    const clicks = (clicksRaw ?? []) as Click[];
    const total = clicks.length;
    const bots = clicks.filter((c) => c.is_bot).length;
    const humans = total - bots;
    const conversionRate = total ? humans / total : 0;

    // Timeseries (day buckets)
    const tsMap = new Map<string, { date: string; humans: number; bots: number }>();
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      tsMap.set(d, { date: d, humans: 0, bots: 0 });
    }
    for (const c of clicks) {
      const d = c.created_at.slice(0, 10);
      const e = tsMap.get(d);
      if (e) { if (c.is_bot) e.bots += 1; else e.humans += 1; }
    }

    // Top reject reasons (split comma-separated reason strings)
    const reasonMap = new Map<string, number>();
    for (const c of clicks) {
      if (!c.is_bot || !c.bot_reason) continue;
      const cleaned = c.bot_reason.split("|")[0]; // strip "verify:" prefix metadata
      const parts = cleaned.replace(/^verify:/, "").split(",").filter(Boolean);
      for (const p of parts) {
        const tag = p.split(":")[0].trim();
        if (!tag) continue;
        reasonMap.set(tag, (reasonMap.get(tag) ?? 0) + 1);
      }
    }
    const topReasons = [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Per-link conversion
    const byLink = (links ?? []).map((l) => {
      const linkClicks = clicks.filter((c) => c.link_id === l.id);
      const lTotal = linkClicks.length;
      const lBots = linkClicks.filter((c) => c.is_bot).length;
      const lHumans = lTotal - lBots;
      return {
        id: l.id,
        short_code: l.short_code,
        title: l.title,
        destination_url: l.destination_url,
        total: lTotal,
        humans: lHumans,
        bots: lBots,
        conversion: lTotal ? lHumans / lTotal : 0,
      };
    }).sort((a, b) => b.total - a.total);

    // Referrer hosts
    const refMap = new Map<string, number>();
    for (const c of clicks) {
      if (!c.referer) { refMap.set("direct", (refMap.get("direct") ?? 0) + 1); continue; }
      try {
        const host = new URL(c.referer).hostname.replace(/^www\./, "");
        refMap.set(host, (refMap.get(host) ?? 0) + 1);
      } catch {
        refMap.set("unknown", (refMap.get("unknown") ?? 0) + 1);
      }
    }
    const referrers = [...refMap.entries()]
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totals: { total, humans, bots, conversionRate },
      timeseries: [...tsMap.values()],
      topReasons,
      byCountry: bucket(clicks, (c) => c.country).slice(0, 15),
      byDevice: bucket(clicks, (c) => c.device),
      byBrowser: bucket(clicks, (c) => c.browser).slice(0, 10),
      byOS: bucket(clicks, (c) => c.os).slice(0, 10),
      byVariant: bucket(clicks, (c) => c.variant),
      byLink,
      referrers,
      links: (links ?? []).map((l) => ({ id: l.id, short_code: l.short_code, title: l.title })),
    };
  });
