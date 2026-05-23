import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — Sleepox" }] }),
  component: UpgradePage,
});

function UpgradePage() {
  const { data } = useQuery({
    queryKey: ["packages-up"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Upgrade your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">Crypto payment via Plisio coming soon.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data?.map((p) => (
          <div key={p.id} className="rounded-lg border border-border p-6">
            <h3 className="font-semibold">{p.name}</h3>
            <div className="mt-3 text-3xl font-bold">${Number(p.price_usd).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{p.click_quota ? `${p.click_quota.toLocaleString()} clicks/mo` : "Unlimited clicks"}</p>
            <p className="text-xs text-muted-foreground">{p.link_limit} link{p.link_limit > 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
