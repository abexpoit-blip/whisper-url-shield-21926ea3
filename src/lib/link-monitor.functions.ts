import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  linkId: z.string().uuid(),
  days: z.number().int().min(1).max(90).default(7),
});

type Click = {
  is_bot: boolean;
  bot_reason: string | null;
  variant: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referer: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referer_host: string | null;
};

export const getLinkMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 24 * 3600 * 1000).toISOString();

    const { data: link } = await supabase
      .from("links")
      .select("id, short_code, title, destination_url, clicks_count, bot_clicks_count, status, created_at, user_id")
      .eq("id", data.linkId)
      .maybeSingle();
    if (!link) throw new Error("Link not found");
    if (link.user_id !== userId) throw new Error("Forbidden");

    const { data: clicksRaw } = await supabase
      .from("clicks")
      .select("is_bot,bot_reason,variant,country,device,browser,os,referer,ip_address,user_agent,created_at,utm_source,utm_medium,utm_campaign,utm_term,utm_content,referer_host")
      .eq("link_id", data.linkId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);

    const clicks = (clicksRaw ?? []) as Click[];
    const impressions = clicks.length;
    const bots = clicks.filter((c) => c.is_bot).length;
    const humans = impressions - bots;
    const botRate = impressions ? bots / impressions : 0;
    const conversionRate = impressions ? humans / impressions : 0;

    // Unique IPs (humans only)
    const uniqHumanIps = new Set(clicks.filter((c) => !c.is_bot && c.ip_address).map((c) => c.ip_address!)).size;

    // Timeseries
    const tsMap = new Map<string, { date: string; impressions: number; humans: number; bots: number }>();
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      tsMap.set(d, { date: d, impressions: 0, humans: 0, bots: 0 });
    }
    for (const c of clicks) {
      const d = c.created_at.slice(0, 10);
      const e = tsMap.get(d);
      if (e) {
        e.impressions += 1;
        if (c.is_bot) e.bots += 1; else e.humans += 1;
      }
    }

    // Rejection reasons
    const reasonMap = new Map<string, number>();
    for (const c of clicks) {
      if (!c.is_bot || !c.bot_reason) continue;
      const cleaned = c.bot_reason.split("|")[0].replace(/^verify:/, "");
      for (const p of cleaned.split(",").filter(Boolean)) {
        const tag = p.split(":")[0].trim();
        if (tag) reasonMap.set(tag, (reasonMap.get(tag) ?? 0) + 1);
      }
    }
    const rejectionReasons = [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count, pct: bots ? count / bots : 0 }))
      .sort((a, b) => b.count - a.count);

    const bucket = (key: (c: Click) => string | null) => {
      const m = new Map<string, { total: number; humans: number; bots: number }>();
      for (const c of clicks) {
        const k = key(c) ?? "unknown";
        const e = m.get(k) ?? { total: 0, humans: 0, bots: 0 };
        e.total += 1;
        if (c.is_bot) e.bots += 1; else e.humans += 1;
        m.set(k, e);
      }
      return [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.total - a.total);
    };

    // Per-source funnel: impressions (initial pageload) → real clicks (verified humans) → conversions (redirect to destination)
    // In our model each visit logs:
    //   1) resolveLink → impression row (bot_reason does NOT start with "verify:")
    //   2) verifyHuman → outcome row (bot_reason starts with "verify:"); !is_bot = redirected to destination
    const isVerify = (c: Click) => !!c.bot_reason?.startsWith("verify:");
    const funnelMap = new Map<string, { impressions: number; realClicks: number; conversions: number }>();
    for (const c of clicks) {
      const k = c.utm_source ?? "(direct/untagged)";
      const e = funnelMap.get(k) ?? { impressions: 0, realClicks: 0, conversions: 0 };
      if (isVerify(c)) {
        if (!c.is_bot) { e.realClicks += 1; e.conversions += 1; }
      } else {
        e.impressions += 1;
      }
      funnelMap.set(k, e);
    }
    const sourceFunnel = [...funnelMap.entries()]
      .map(([source, v]) => ({
        source,
        ...v,
        ctr: v.impressions ? v.realClicks / v.impressions : 0,
        conversionRate: v.impressions ? v.conversions / v.impressions : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    // Overall funnel totals (across all sources)
    let impFunnel = 0, realFunnel = 0, convFunnel = 0;
    for (const c of clicks) {
      if (isVerify(c)) {
        if (!c.is_bot) { realFunnel += 1; convFunnel += 1; }
      } else {
        impFunnel += 1;
      }
    }
    const overallFunnel = [
      { stage: "Impressions", count: impFunnel, pct: 100 },
      { stage: "Real clicks", count: realFunnel, pct: impFunnel ? (realFunnel / impFunnel) * 100 : 0 },
      { stage: "Conversions", count: convFunnel, pct: impFunnel ? (convFunnel / impFunnel) * 100 : 0 },
    ];

    // Recent click sample
    const recent = clicks.slice(0, 25).map((c) => ({
      created_at: c.created_at,
      is_bot: c.is_bot,
      reason: c.bot_reason?.split("|")[0] ?? null,
      country: c.country,
      device: c.device,
      browser: c.browser,
      variant: c.variant,
      ip: c.ip_address ? c.ip_address.replace(/\.\d+$/, ".•") : null,
      ua: c.user_agent?.slice(0, 80) ?? null,
      utm_source: c.utm_source,
      utm_campaign: c.utm_campaign,
      referer_host: c.referer_host,
    }));

    return {
      link: {
        id: link.id,
        short_code: link.short_code,
        title: link.title,
        destination_url: link.destination_url,
        status: link.status,
        created_at: link.created_at,
      },
      totals: { impressions, humans, bots, botRate, conversionRate, uniqHumanIps },
      timeseries: [...tsMap.values()],
      rejectionReasons,
      byVariant: bucket((c) => c.variant),
      byCountry: bucket((c) => c.country).slice(0, 10),
      byDevice: bucket((c) => c.device),
      byBrowser: bucket((c) => c.browser).slice(0, 10),
      byOS: bucket((c) => c.os).slice(0, 10),
      bySource: bucket((c) => c.utm_source).slice(0, 15),
      byMedium: bucket((c) => c.utm_medium).slice(0, 10),
      byCampaign: bucket((c) => c.utm_campaign).slice(0, 15),
      byReferer: bucket((c) => c.referer_host).slice(0, 15),
      recent,
    };
  });
