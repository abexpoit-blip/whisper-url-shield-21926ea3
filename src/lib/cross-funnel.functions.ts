import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSelfHostedAuth } from "@/lib/self-host-auth.server";

const Schema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  linkIds: z.array(z.string().uuid()).max(50).optional(),
});

type ClickRow = {
  link_id: string;
  is_bot: boolean;
  bot_reason: string | null;
};

export const getCrossLinkFunnel = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let linksQ = supabase
      .from("links")
      .select("id, short_code, title, destination_url, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data.linkIds && data.linkIds.length) linksQ = linksQ.in("id", data.linkIds);
    const { data: links } = await linksQ;
    const linkList = links ?? [];
    if (!linkList.length) {
      return { rows: [], totals: { impressions: 0, realClicks: 0, conversions: 0 } };
    }

    const ids = linkList.map((l) => l.id);
    const { data: clicksRaw } = await supabase
      .from("clicks")
      .select("link_id,is_bot,bot_reason")
      .in("link_id", ids)
      .gte("created_at", data.from)
      .lte("created_at", data.to)
      .limit(50000);

    const clicks = (clicksRaw ?? []) as ClickRow[];
    const isVerify = (c: ClickRow) => !!c.bot_reason?.startsWith("verify:");

    const m = new Map<string, { impressions: number; realClicks: number; conversions: number }>();
    for (const l of linkList) m.set(l.id, { impressions: 0, realClicks: 0, conversions: 0 });
    for (const c of clicks) {
      const e = m.get(c.link_id);
      if (!e) continue;
      if (isVerify(c)) {
        if (!c.is_bot) { e.realClicks += 1; e.conversions += 1; }
      } else {
        e.impressions += 1;
      }
    }

    let tImp = 0, tReal = 0, tConv = 0;
    const rows = linkList.map((l) => {
      const v = m.get(l.id)!;
      tImp += v.impressions; tReal += v.realClicks; tConv += v.conversions;
      return {
        id: l.id,
        short_code: l.short_code,
        title: l.title,
        destination_url: l.destination_url,
        status: l.status,
        impressions: v.impressions,
        realClicks: v.realClicks,
        conversions: v.conversions,
        ctr: v.impressions ? v.realClicks / v.impressions : 0,
        conversionRate: v.impressions ? v.conversions / v.impressions : 0,
      };
    }).sort((a, b) => b.impressions - a.impressions);

    return {
      rows,
      totals: { impressions: tImp, realClicks: tReal, conversions: tConv },
    };
  });
