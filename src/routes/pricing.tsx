import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — Sleepox" }] }),
  component: PricingPage,
});

function PricingPage() {
  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold">Sleepox</Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/login" className="hover:underline">Login</Link>
            <Link to="/signup" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90">Sign up</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-bold">Plans</h1>
        <p className="mt-2 text-muted-foreground">Pay with crypto. Upgrade or downgrade anytime.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {packages?.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <div className="mt-3 text-3xl font-bold">${Number(p.price_usd).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{p.click_quota ? `${p.click_quota.toLocaleString()} clicks / mo` : "Unlimited clicks"}</p>
              <p className="text-xs text-muted-foreground">{p.link_limit} link{p.link_limit > 1 ? "s" : ""}</p>
              <Link to="/signup" className="mt-6 block rounded-md bg-primary py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Get started
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
