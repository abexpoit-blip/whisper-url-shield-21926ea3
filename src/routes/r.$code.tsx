import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const resolveLink = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => z.object({ code: z.string().min(1).max(32) }).parse(input))
  .handler(async ({ data }) => {
    const ua = getRequestHeader("user-agent") || "";
    const referer = getRequestHeader("referer") || "";
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for") || "";
    const country = getRequestHeader("cf-ipcountry") || null;

    const { data: link } = await supabaseAdmin
      .from("links")
      .select("id, destination_url, status")
      .eq("short_code", data.code)
      .maybeSingle();

    if (!link || link.status !== "active") return { found: false as const };

    // Basic bot detection
    const lowerUa = ua.toLowerCase();
    const botPatterns = ["bot", "crawler", "spider", "facebookexternalhit", "headless", "curl", "wget", "python", "scrapy"];
    const isBot = botPatterns.some((p) => lowerUa.includes(p)) || !ua;
    const botReason = isBot ? botPatterns.find((p) => lowerUa.includes(p)) || "missing-ua" : null;

    // Log click
    await supabaseAdmin.from("clicks").insert({
      link_id: link.id,
      ip_address: ip || null,
      country,
      user_agent: ua || null,
      referer: referer || null,
      is_bot: isBot,
      bot_reason: botReason,
    });

    // Increment counter
    if (isBot) {
      await supabaseAdmin.rpc("increment_bot_count" as never, { link_id_in: link.id } as never).then(() => {});
      await supabaseAdmin
        .from("links")
        .update({ bot_clicks_count: 0 })
        .eq("id", link.id);
    }

    // Simpler: just refetch + increment
    const field = isBot ? "bot_clicks_count" : "clicks_count";
    const { data: current } = await supabaseAdmin
      .from("links")
      .select(field)
      .eq("id", link.id)
      .single();
    if (current) {
      await supabaseAdmin
        .from("links")
        .update({ [field]: (current as Record<string, number>)[field] + 1 })
        .eq("id", link.id);
    }

    return {
      found: true as const,
      destination: link.destination_url,
      isBot,
    };
  });

export const Route = createFileRoute("/r/$code")({
  loader: async ({ params }) => {
    const result = await resolveLink({ data: { code: params.code } });
    if (!result.found) throw notFound();
    return result;
  },
  component: RedirectPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This short link doesn't exist or has been removed.</p>
      </div>
    </div>
  ),
});

function RedirectPage() {
  const data = Route.useLoaderData();

  useEffect(() => {
    if (!data.isBot) {
      window.location.replace(data.destination);
    }
  }, [data]);

  if (data.isBot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please wait while we verify your request.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
