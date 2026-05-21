import { createFileRoute } from "@tanstack/react-router";
import { computeScoresAdmin, recomputeVariantTestsAdmin } from "@/lib/auto-pilot.functions";
import { requirePublicHookSecret } from "@/lib/public-hook-auth.server";

export const Route = createFileRoute("/api/public/hooks/autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requirePublicHookSecret(request);
        if (unauthorized) return unauthorized;
        try {
          const scores = await computeScoresAdmin();
          const variants = await recomputeVariantTestsAdmin();
          return Response.json({ ok: true, scores, variants });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
