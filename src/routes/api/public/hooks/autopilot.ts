import { createFileRoute } from "@tanstack/react-router";
import { computeScoresAdmin, recomputeVariantTestsAdmin } from "@/lib/auto-pilot.functions";

export const Route = createFileRoute("/api/public/hooks/autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // optional shared header verify
        const auth = request.headers.get("apikey") ?? request.headers.get("authorization");
        if (!auth) {
          return new Response(JSON.stringify({ error: "Missing apikey" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
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
