import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requirePublicHookSecret } from "@/lib/public-hook-auth.server";

// Backfill missing Phase 3 columns (fingerprint_hash, signals, bot_score) on
// historical click rows by recomputing approximate values from the stored
// user_agent + bot_reason + is_bot + country/device/os/browser. Safe to call
// repeatedly — only rows missing at least one of the three fields are touched.
//
// Trigger:
//   curl -X POST "https://<host>/api/public/hooks/backfill-clicks?limit=500"
//
// Or schedule from pg_cron to drain the backlog gradually.

function admin() {
  const url =
    process.env.REDIRECT_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "http://127.0.0.1:8000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for backfill");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const BOT_UA_RE =
  /bot|crawler|spider|scraper|headless|phantom|selenium|puppeteer|playwright|curl|wget|python|scrapy|go-http|java\/|okhttp|axios|node-fetch|googlebot|bingbot|yandex|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot/i;

async function hashFp(payload: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(payload);
    const d = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(d))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    let h = 5381;
    for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16).padStart(8, "0");
  }
}

export const Route = createFileRoute("/api/public/hooks/backfill-clicks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requirePublicHookSecret(request);
        if (unauthorized) return unauthorized;
        const sb = admin();
        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 500), 1), 2000);

        const { data: rows, error } = await sb
          .from("clicks")
          .select(
            "id, user_agent, ip_address, country, device, os, browser, referer, bot_reason, is_bot, fingerprint_hash, bot_score, signals, created_at"
          )
          .or("fingerprint_hash.is.null,bot_score.is.null,signals.is.null")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const r of rows ?? []) {
          const ua = r.user_agent || "";
          const reasons: string[] = [];
          let score = 0;
          if (!ua) {
            score += 50;
            reasons.push("no-ua");
          }
          if (ua && BOT_UA_RE.test(ua)) {
            score += 60;
            reasons.push("ua-bot");
          }
          if (r.is_bot) score = Math.max(score, 60);
          if (r.bot_reason) {
            reasons.push(`backfill-source:${r.bot_reason.slice(0, 60)}`);
          }

          const fp =
            r.fingerprint_hash ||
            (await hashFp(
              [
                ua,
                "backfill",
                "",
                "0",
                "0",
                "0x0x0",
                "",
                [r.country || "", r.device || "", r.os || "", r.browser || ""].join("|"),
              ].join("|")
            ));

          const patch: {
            fingerprint_hash?: string;
            bot_score?: number;
            signals?: Record<string, unknown>;
          } = {};
          if (!r.fingerprint_hash) patch.fingerprint_hash = fp;
          if (r.bot_score == null) patch.bot_score = Math.min(score, 500);
          if (!r.signals) {
            patch.signals = {
              phase: 3,
              source: "backfill",
              serverScore: score,
              hardBot: false,
              requestBot: r.is_bot,
              uaPresent: Boolean(ua),
              wasBot: r.is_bot,
              reasons,
            };
          }

          if (Object.keys(patch).length === 0) {
            skipped++;
            continue;
          }

          const { error: uerr } = await sb.from("clicks").update(patch as never).eq("id", r.id);
          if (uerr) {
            errors.push(`${r.id}: ${uerr.message}`);
          } else {
            updated++;
          }
        }


        console.log(
          JSON.stringify({
            evt: "backfill.run",
            ts: new Date().toISOString(),
            scanned: rows?.length ?? 0,
            updated,
            skipped,
            errors: errors.length,
          })
        );

        return new Response(
          JSON.stringify({
            scanned: rows?.length ?? 0,
            updated,
            skipped,
            errors: errors.slice(0, 10),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
