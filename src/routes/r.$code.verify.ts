import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyChallengeToken } from "@/lib/click-challenge.server";
import { recordRedirectClick, lookupRedirectLink } from "./r.$code";

const SAFE_FALLBACK = "https://sleepox.com/";

type Signals = {
  webdriver?: boolean;
  cookie?: boolean;
  elapsed?: number;
  moved?: boolean;
  scrolled?: boolean;
  touched?: boolean;
  fp?: string;
  lang?: string;
  platform?: string;
  hw?: number;
  tz?: number;
  screen?: string;
};

function evaluateSignals(s: Signals): { passed: boolean; reason: string | null } {
  if (s.webdriver === true) return { passed: false, reason: "webdriver" };
  if (s.cookie === false) return { passed: false, reason: "no-cookie" };
  if (typeof s.elapsed !== "number" || s.elapsed < 1400) return { passed: false, reason: "too-fast" };
  if (!s.fp) return { passed: false, reason: "no-canvas" };
  return { passed: true, reason: null };
}

export const Route = createFileRoute("/r/$code/verify")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: { token?: string; signals?: Signals };
        try {
          body = (await request.json()) as { token?: string; signals?: Signals };
        } catch {
          return Response.json({ url: SAFE_FALLBACK }, { status: 200 });
        }
        const token = body?.token;
        const signals = body?.signals || {};
        if (!token) return Response.json({ url: SAFE_FALLBACK }, { status: 200 });

        const payload = await verifyChallengeToken(token);
        if (!payload) return Response.json({ url: SAFE_FALLBACK }, { status: 200 });

        // Re-lookup link to fetch userId + safe_url (token bound to linkId only)
        const { link } = await lookupRedirectLink(params.code);
        if (!link || link.id !== payload.linkId) {
          return Response.json({ url: SAFE_FALLBACK }, { status: 200 });
        }

        const verdict = evaluateSignals(signals);
        const finalUrl = verdict.passed
          ? payload.target
          : link.safe_url || SAFE_FALLBACK;
        const finalRoute: "safe" | "offer" | "ours" = verdict.passed
          ? payload.routedTo
          : "safe";

        const ua = request.headers.get("user-agent") || "";
        const country =
          request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country") || "";
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          request.headers.get("x-real-ip") || "";
        const referer = request.headers.get("referer") || "";
        const refererHost = (() => {
          try { return referer ? new URL(referer).hostname : ""; } catch { return ""; }
        })();

        // Fire-and-forget click recording
        recordRedirectClick({
          linkId: link.id,
          userId: link.user_id,
          ip: ip || null,
          country: country || null,
          ua: ua || null,
          isBot: !verdict.passed,
          botReason: verdict.passed ? null : `challenge:${verdict.reason}`,
          routedTo: finalRoute,
          utm: {
            utm_source: null, utm_medium: null, utm_campaign: null,
            utm_term: null, utm_content: null,
          },
          refererHost: refererHost || null,
          botScore: verdict.passed ? 0 : 80,
          challengePassed: verdict.passed,
          prelandingShown: true,
          signals: {
            source: "prelanding",
            verdict: verdict.passed ? "pass" : `fail:${verdict.reason}`,
            ...signals,
          },
        }).catch((error) => console.error("verify click logging failed", { linkId: link.id, error }));

        return Response.json(
          { url: finalUrl },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
