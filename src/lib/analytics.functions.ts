import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Click = {
  id: string;
  link_id: string;
  country: string | null;
  ua: string | null;
  is_bot: boolean;
  routed_to: string;
  created_at: string;
};

function deviceFromUA(ua: string | null): "Mobile" | "Desktop" | "Tablet" | "Other" {
  if (!ua) return "Other";
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "Tablet";
  if (/mobi|android|iphone|ipod/.test(u)) return "Mobile";
  if (/windows|macintosh|linux|x11/.test(u)) return "Desktop";
  return "Other";
}

function browserFromUA(ua: string | null): string {
  if (!ua) return "Unknown";
  const u = ua.toLowerCase();
  if (u.includes("edg/")) return "Edge";
  if (u.includes("opr/") || u.includes("opera")) return "Opera";
  if (u.includes("chrome")) return "Chrome";
  if (u.includes("firefox")) return "Firefox";
  if (u.includes("safari")) return "Safari";
  return "Other";
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", CA: "🇨🇦", IN: "🇮🇳", BD: "🇧🇩",
  PK: "🇵🇰", JP: "🇯🇵", CN: "🇨🇳", BR: "🇧🇷", AU: "🇦🇺", NL: "🇳🇱", IT: "🇮🇹",
  ES: "🇪🇸", MX: "🇲🇽", RU: "🇷🇺", ID: "🇮🇩", PH: "🇵🇭", NG: "🇳🇬", ZA: "🇿🇦",
  SE: "🇸🇪", PL: "🇵🇱", TR: "🇹🇷", KR: "🇰🇷", VN: "🇻🇳", AE: "🇦🇪", SA: "🇸🇦",
};

export const getAnalyticsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Get user's link IDs (RLS-friendly join via link ownership)
    const { data: links, error: linkErr } = await supabase
      .from("links")
      .select("id, short_code, title")
      .eq("user_id", userId);
    if (linkErr) throw new Error(linkErr.message);

    const linkIds = (links ?? []).map((l) => l.id);
    if (linkIds.length === 0) {
      return empty();
    }

    // Last 7 days of clicks (cap at 50k for safety)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: clicksRaw, error: clickErr } = await supabase
      .from("clicks")
      .select("id, link_id, country, ua, is_bot, routed_to, created_at")
      .in("link_id", linkIds)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50000);
    if (clickErr) throw new Error(clickErr.message);

    const clicks = (clicksRaw ?? []) as Click[];
    const now = Date.now();

    // KPIs
    const total = clicks.length;
    const bots = clicks.filter((c) => c.is_bot).length;
    const humans = total - bots;
    const last60s = clicks.filter((c) => now - new Date(c.created_at).getTime() < 60_000).length;
    const cps = (last60s / 60).toFixed(1);
    const last24h = clicks.filter((c) => now - new Date(c.created_at).getTime() < 86_400_000).length;

    // 24h series — bucket by hour
    const hourBuckets = new Array(24).fill(0);
    clicks
      .filter((c) => now - new Date(c.created_at).getTime() < 86_400_000)
      .forEach((c) => {
        const hoursAgo = Math.floor((now - new Date(c.created_at).getTime()) / 3_600_000);
        if (hoursAgo >= 0 && hoursAgo < 24) hourBuckets[23 - hoursAgo]++;
      });

    // 7d x 24h heatmap (day index 0=oldest, 6=today)
    const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    clicks.forEach((c) => {
      const t = new Date(c.created_at).getTime();
      const dayIdx = 6 - Math.floor((now - t) / 86_400_000);
      const hour = new Date(c.created_at).getUTCHours();
      if (dayIdx >= 0 && dayIdx < 7) heatmap[dayIdx][hour]++;
    });
    const heatMax = Math.max(1, ...heatmap.flat());

    // Top countries
    const countryMap = new Map<string, number>();
    clicks.forEach((c) => {
      const k = (c.country ?? "??").toUpperCase();
      countryMap.set(k, (countryMap.get(k) ?? 0) + 1);
    });
    const topCountries = [...countryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([code, count]) => ({
        code,
        flag: COUNTRY_FLAGS[code] ?? "🌐",
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }));

    // Devices
    const deviceMap = new Map<string, number>();
    clicks.forEach((c) => {
      const d = deviceFromUA(c.ua);
      deviceMap.set(d, (deviceMap.get(d) ?? 0) + 1);
    });
    const devices = [...deviceMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }));

    // Browsers
    const browserMap = new Map<string, number>();
    clicks.forEach((c) => {
      const b = browserFromUA(c.ua);
      browserMap.set(b, (browserMap.get(b) ?? 0) + 1);
    });
    const browsers = [...browserMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }));

    // Top links leaderboard
    const linkMap = new Map<string, number>();
    clicks.forEach((c) => linkMap.set(c.link_id, (linkMap.get(c.link_id) ?? 0) + 1));
    const linkLookup = new Map((links ?? []).map((l) => [l.id, l]));
    const topLinks = [...linkMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const l = linkLookup.get(id);
        return {
          id,
          code: l?.short_code ?? "—",
          title: l?.title ?? null,
          count,
        };
      });

    // Live event stream — last 12
    const liveEvents = clicks.slice(0, 12).map((c) => ({
      id: c.id,
      time: c.created_at,
      country: c.country?.toUpperCase() ?? "??",
      flag: COUNTRY_FLAGS[(c.country ?? "").toUpperCase()] ?? "🌐",
      isBot: c.is_bot,
      routed: c.routed_to,
    }));

    return {
      kpis: {
        total,
        humans,
        bots,
        cps,
        last24h,
        humanRate: total ? Math.round((humans / total) * 1000) / 10 : 100,
        activeLinks: linkIds.length,
      },
      series24h: hourBuckets,
      heatmap,
      heatMax,
      topCountries,
      devices,
      browsers,
      topLinks,
      liveEvents,
    };
  });

function empty() {
  return {
    kpis: { total: 0, humans: 0, bots: 0, cps: "0.0", last24h: 0, humanRate: 100, activeLinks: 0 },
    series24h: new Array(24).fill(0),
    heatmap: Array.from({ length: 7 }, () => new Array(24).fill(0)),
    heatMax: 1,
    topCountries: [] as Array<{ code: string; flag: string; count: number; pct: number }>,
    devices: [] as Array<{ name: string; count: number; pct: number }>,
    browsers: [] as Array<{ name: string; count: number; pct: number }>,
    topLinks: [] as Array<{ id: string; code: string; title: string | null; count: number }>,
    liveEvents: [] as Array<{ id: string; time: string; country: string; flag: string; isBot: boolean; routed: string }>,
  };
}
