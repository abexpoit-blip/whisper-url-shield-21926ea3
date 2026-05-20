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

const CountrySchema = z.object({
  country: z.string().min(2).max(2),
  days: z.number().int().min(1).max(90).default(7),
  linkId: z.string().uuid().optional().nullable(),
});

export const getCountryDrilldown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CountrySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 24 * 3600 * 1000).toISOString();

    let linksQ = supabase.from("links").select("id, short_code, title");
    if (data.linkId) linksQ = linksQ.eq("id", data.linkId);
    const { data: links } = await linksQ;
    const linkIds = (links ?? []).map((l) => l.id);
    if (linkIds.length === 0) {
      return {
        country: data.country,
        totals: { total: 0, humans: 0, bots: 0, ctr: 0 },
        byDevice: [], byBrowser: [], byOS: [], byLink: [], timeseries: [],
      };
    }

    const { data: clicksRaw } = await supabase
      .from("clicks")
      .select("link_id,is_bot,device,os,browser,created_at")
      .in("link_id", linkIds)
      .eq("country", data.country.toUpperCase())
      .gte("created_at", since)
      .limit(10000);

    const clicks = (clicksRaw ?? []) as Click[];
    const total = clicks.length;
    const bots = clicks.filter((c) => c.is_bot).length;
    const humans = total - bots;
    const ctr = total ? humans / total : 0;

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

    const byLink = (links ?? [])
      .map((l) => {
        const lc = clicks.filter((c) => c.link_id === l.id);
        const lt = lc.length;
        const lb = lc.filter((c) => c.is_bot).length;
        return {
          id: l.id, short_code: l.short_code, title: l.title,
          total: lt, humans: lt - lb, bots: lb, conversion: lt ? (lt - lb) / lt : 0,
        };
      })
      .filter((l) => l.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return {
      country: data.country.toUpperCase(),
      totals: { total, humans, bots, ctr },
      byDevice: bucket(clicks, (c) => c.device),
      byBrowser: bucket(clicks, (c) => c.browser).slice(0, 8),
      byOS: bucket(clicks, (c) => c.os).slice(0, 8),
      byLink,
      timeseries: [...tsMap.values()],
    };
  });

const DiagSchema = z.object({
  days: z.number().int().min(1).max(90).default(7),
  linkId: z.string().uuid().optional().nullable(),
});

type DiagSeverity = "high" | "medium" | "low" | "ok";
type DiagFinding = {
  id: string;
  category: "click_pattern" | "geo_mismatch" | "session" | "quality";
  severity: DiagSeverity;
  title: string;
  description: string;
  metric: string;
  suggestion: string;
};

export const getAdRejectDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DiagSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 24 * 3600 * 1000).toISOString();

    let linksQ = supabase.from("links").select("id");
    if (data.linkId) linksQ = linksQ.eq("id", data.linkId);
    const { data: links } = await linksQ;
    const linkIds = (links ?? []).map((l) => l.id);

    if (linkIds.length === 0) {
      return { findings: [] as DiagFinding[], score: 100, summary: { total: 0, bots: 0, humans: 0 } };
    }

    const { data: clicksRaw } = await supabase
      .from("clicks")
      .select("link_id,is_bot,country,bot_reason,ip_address,referer,referer_host,utm_source,utm_campaign,created_at")
      .in("link_id", linkIds)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(10000);

    type C = {
      link_id: string; is_bot: boolean; country: string | null; bot_reason: string | null;
      ip_address: string | null; referer: string | null; referer_host: string | null;
      utm_source: string | null; utm_campaign: string | null; created_at: string;
    };
    const clicks = (clicksRaw ?? []) as C[];
    const total = clicks.length;
    const bots = clicks.filter((c) => c.is_bot).length;
    const humans = total - bots;
    const findings: DiagFinding[] = [];

    if (total === 0) {
      return { findings, score: 100, summary: { total, bots, humans } };
    }

    // ---- 1. CLICK PATTERN: bot ratio
    const botRatio = bots / total;
    if (botRatio >= 0.4) {
      findings.push({
        id: "high_bot_ratio", category: "click_pattern", severity: "high",
        title: "High bot rejection ratio",
        description: `${(botRatio * 100).toFixed(1)}% of incoming traffic was flagged as non-human.`,
        metric: `${bots.toLocaleString()} / ${total.toLocaleString()} clicks`,
        suggestion: "Audit traffic sources — pause campaigns sending mostly datacenter or proxy traffic.",
      });
    } else if (botRatio >= 0.2) {
      findings.push({
        id: "elevated_bot_ratio", category: "click_pattern", severity: "medium",
        title: "Elevated bot ratio",
        description: `${(botRatio * 100).toFixed(1)}% bot rate is above the safe threshold (20%).`,
        metric: `${bots.toLocaleString()} bots blocked`,
        suggestion: "Tighten ASN blocklist and review referer rules for low-quality sources.",
      });
    }

    // ---- 2. CLICK PATTERN: IP concentration
    const ipMap = new Map<string, number>();
    for (const c of clicks) {
      if (!c.ip_address) continue;
      ipMap.set(c.ip_address, (ipMap.get(c.ip_address) ?? 0) + 1);
    }
    const ipEntries = [...ipMap.entries()].sort((a, b) => b[1] - a[1]);
    const topIp = ipEntries[0];
    if (topIp && total >= 20) {
      const share = topIp[1] / total;
      if (share >= 0.15) {
        findings.push({
          id: "ip_concentration", category: "click_pattern", severity: share >= 0.3 ? "high" : "medium",
          title: "Suspicious IP concentration",
          description: `A single IP generated ${(share * 100).toFixed(1)}% of all clicks (${topIp[1]} hits).`,
          metric: `IP …${topIp[0].slice(-6)} · ${topIp[1]} clicks`,
          suggestion: "Add this IP to the blocklist or enable duplicate-click protection on the link.",
        });
      }
    }
    const repeatIPs = ipEntries.filter(([, n]) => n >= 5).length;
    if (repeatIPs >= 5) {
      findings.push({
        id: "repeat_ips", category: "click_pattern", severity: "medium",
        title: "Many repeat-click IPs",
        description: `${repeatIPs} different IPs sent 5+ clicks each — likely automated or fraudulent.`,
        metric: `${repeatIPs} repeat IPs`,
        suggestion: "Lower the duplicate-window threshold or enforce stricter rate limits.",
      });
    }

    // ---- 3. CLICK PATTERN: burst detection (clicks/minute spikes)
    const minuteBuckets = new Map<string, number>();
    for (const c of clicks) {
      const m = c.created_at.slice(0, 16); // YYYY-MM-DDTHH:MM
      minuteBuckets.set(m, (minuteBuckets.get(m) ?? 0) + 1);
    }
    const burstMinutes = [...minuteBuckets.values()].filter((n) => n >= 20).length;
    if (burstMinutes > 0) {
      findings.push({
        id: "burst_traffic", category: "click_pattern", severity: burstMinutes >= 5 ? "high" : "medium",
        title: "Burst-click pattern detected",
        description: `${burstMinutes} minute(s) saw 20+ clicks — classic ad-fraud or scraper signature.`,
        metric: `${burstMinutes} burst windows`,
        suggestion: "Enable rate-limit protection in Bot Defense settings and review the time of attack.",
      });
    }

    // ---- 4. GEOGRAPHY mismatch
    const countryMap = new Map<string, number>();
    for (const c of clicks) {
      const k = c.country ?? "unknown";
      countryMap.set(k, (countryMap.get(k) ?? 0) + 1);
    }
    const unknownGeo = countryMap.get("unknown") ?? 0;
    if (total >= 20 && unknownGeo / total >= 0.25) {
      findings.push({
        id: "unknown_geo", category: "geo_mismatch", severity: "medium",
        title: "High share of unknown geography",
        description: `${((unknownGeo / total) * 100).toFixed(1)}% of clicks have no country resolved — often VPN/proxy traffic.`,
        metric: `${unknownGeo} unknown-geo clicks`,
        suggestion: "Block anonymizers in protection settings or restrict to allow-listed countries.",
      });
    }
    const sortedCountries = [...countryMap.entries()].filter(([k]) => k !== "unknown").sort((a, b) => b[1] - a[1]);
    if (sortedCountries.length >= 3 && total >= 30) {
      const topShare = sortedCountries[0][1] / total;
      // Geo mismatch: campaign targeting a specific country (UTM hints) but traffic spread thin
      const utmGeoHints = clicks
        .map((c) => `${c.utm_campaign ?? ""} ${c.utm_source ?? ""}`.toLowerCase())
        .filter(Boolean)
        .join(" ");
      const targetCodes = ["us", "usa", "uk", "in", "br", "de", "fr", "ca", "au"];
      const hinted = targetCodes.find((t) => utmGeoHints.includes(t));
      if (hinted) {
        const hintCountry = hinted === "us" || hinted === "usa" ? "US" : hinted === "uk" ? "GB" : hinted.toUpperCase();
        const actual = countryMap.get(hintCountry) ?? 0;
        const actualShare = actual / total;
        if (actualShare < 0.5) {
          findings.push({
            id: "geo_target_mismatch", category: "geo_mismatch", severity: "high",
            title: "Campaign geo target mismatch",
            description: `UTM hints target ${hintCountry}, but only ${(actualShare * 100).toFixed(1)}% of clicks come from there.`,
            metric: `${actual} of ${total} from ${hintCountry}`,
            suggestion: "Add a geo rule to redirect off-target traffic, or fix UTM placements at the source.",
          });
        }
      }
      if (topShare < 0.25) {
        findings.push({
          id: "geo_scattered", category: "geo_mismatch", severity: "low",
          title: "Geographically scattered traffic",
          description: `Top country only accounts for ${(topShare * 100).toFixed(1)}% — traffic is spread across many regions.`,
          metric: `${sortedCountries.length} countries`,
          suggestion: "Consider geo-targeting rules to focus on the regions with the highest CTR.",
        });
      }
    }

    // ---- 5. SESSION duration / engagement (proxy via inter-click gap per IP)
    const ipGaps: number[] = [];
    const ipLast = new Map<string, number>();
    for (const c of clicks) {
      const t = Date.parse(c.created_at);
      if (!c.ip_address) continue;
      const prev = ipLast.get(c.ip_address);
      if (prev !== undefined) ipGaps.push((t - prev) / 1000);
      ipLast.set(c.ip_address, t);
    }
    if (ipGaps.length >= 10) {
      const sorted = [...ipGaps].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const fastGaps = ipGaps.filter((g) => g < 3).length;
      const fastShare = fastGaps / ipGaps.length;
      if (fastShare >= 0.2) {
        findings.push({
          id: "short_sessions", category: "session", severity: fastShare >= 0.4 ? "high" : "medium",
          title: "Short session duration",
          description: `${(fastShare * 100).toFixed(0)}% of repeat clicks happened within 3 seconds — sub-bounce behaviour.`,
          metric: `median gap ${median.toFixed(1)}s`,
          suggestion: "Real users rarely re-click that fast. Enable challenge/JS verify in Bot Defense.",
        });
      } else if (median < 10) {
        findings.push({
          id: "low_engagement", category: "session", severity: "low",
          title: "Low engagement window",
          description: `Median time between clicks per visitor is only ${median.toFixed(1)}s.`,
          metric: `median ${median.toFixed(1)}s`,
          suggestion: "Add a prelander or a longer content page to lift engagement signals.",
        });
      }
    }

    // ---- 6. QUALITY: missing referer
    const noRef = clicks.filter((c) => !c.referer).length;
    if (total >= 30 && noRef / total >= 0.6) {
      findings.push({
        id: "no_referer", category: "quality", severity: "medium",
        title: "Most traffic has no referer",
        description: `${((noRef / total) * 100).toFixed(1)}% of clicks arrived with no referer header.`,
        metric: `${noRef} direct/no-ref`,
        suggestion: "Direct traffic at scale often indicates scripted hits. Validate the upstream source.",
      });
    }

    // ---- Health score: 100 minus weighted penalties
    const weight = { high: 25, medium: 12, low: 5, ok: 0 } as const;
    const penalty = findings.reduce((s, f) => s + weight[f.severity], 0);
    const score = Math.max(0, 100 - penalty);

    // Sort: high → medium → low
    const order = { high: 0, medium: 1, low: 2, ok: 3 } as const;
    findings.sort((a, b) => order[a.severity] - order[b.severity]);

    return { findings, score, summary: { total, bots, humans } };
  });
