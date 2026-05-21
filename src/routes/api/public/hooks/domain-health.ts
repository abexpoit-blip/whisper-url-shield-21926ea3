import { createFileRoute } from "@tanstack/react-router";
import { runAllDomainHealthChecks } from "@/lib/domain-health.functions";
import { requirePublicHookSecret } from "@/lib/public-hook-auth.server";

export const Route = createFileRoute("/api/public/hooks/domain-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requirePublicHookSecret(request);
        if (unauthorized) return unauthorized;
        try {
          const checked = await runAllDomainHealthChecks();
          return new Response(JSON.stringify({ ok: true, checked }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
