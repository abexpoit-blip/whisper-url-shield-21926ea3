import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createInvoice, getMyOrders } from "@/lib/billing.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — Sleepox" }] }),
  component: UpgradePage,
});

function UpgradePage() {
  const buy = useServerFn(createInvoice);
  const orders = useServerFn(getMyOrders);

  const { data: packages } = useQuery({
    queryKey: ["packages-up"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: ordersList } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => orders(),
  });

  const buyMut = useMutation({
    mutationFn: (slug: "monthly" | "lifetime") => buy({ data: { package_slug: slug } }),
    onSuccess: (r) => { window.location.href = r.invoice_url; },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Upgrade your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pay with crypto (USDT, BTC, LTC) via Plisio. Instant activation after blockchain confirmation.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {packages?.map((p) => {
          const isFree = p.slug === "free";
          const meta = PLAN_META[p.slug] ?? { blurb: "", features: [] };
          const highlight = p.slug === "monthly";
          return (
            <div
              key={p.id}
              className={`relative rounded-2xl p-8 ${highlight ? "glass-panel sky-glow border border-sky scale-[1.02]" : "glass-card"}`}
            >
              {meta.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-gradient px-3 py-1 text-xs font-bold text-primary-foreground whitespace-nowrap">
                  {meta.badge}
                </div>
              )}
              <h3 className="text-xl font-bold">{p.name}</h3>
              {meta.blurb && <p className="mt-1 text-xs text-muted-foreground">{meta.blurb}</p>}
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-gradient-sky">${Number(p.price_usd).toFixed(0)}</span>
                <span className="text-sm text-muted-foreground">
                  {p.slug === "lifetime" ? "/ lifetime" : p.slug === "monthly" ? "/ month" : ""}
                </span>
              </div>
              <div className="mt-6 space-y-1 text-sm">
                <div className="font-medium">{p.click_quota ? `${p.click_quota.toLocaleString()} clicks` : "Unlimited clicks"}</div>
                <div className="text-muted-foreground">{p.link_limit === null ? "Unlimited links" : `${p.link_limit} link${p.link_limit > 1 ? "s" : ""}`}</div>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {meta.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 text-success">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={isFree || buyMut.isPending}
                onClick={() => buyMut.mutate(p.slug as "monthly" | "lifetime")}
                className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-semibold ${highlight ? "bg-sky-gradient text-primary-foreground sky-glow" : "border border-sky hover:bg-secondary"} ${isFree ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isFree ? "Current free plan" : buyMut.isPending ? "Creating invoice…" : `Pay with crypto`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        💡 Smart pick: <span className="font-semibold text-foreground">Lifetime Unlimited</span> pays for itself in 10 months vs Monthly Pro.
      </p>

      {ordersList && ordersList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Order history</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-left">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Package</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {ordersList.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{o.package_slug}</td>
                    <td className="px-4 py-2">${Number(o.amount).toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${o.status === "completed" ? "bg-success/20 text-success" : o.status === "pending" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      {o.plisio_invoice_url && o.status === "pending" && (
                        <a href={o.plisio_invoice_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Open</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
