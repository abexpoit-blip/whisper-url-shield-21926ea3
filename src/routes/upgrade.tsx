/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Sparkles,
  Rocket,
  Copy,
  ExternalLink,
  Clock,
  ShieldCheck,
  Bitcoin,
} from "lucide-react";
import { getMyPlan, listMyUpgradeRequests, listAvailablePackages } from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getVerifiedClientSession, requireClientUser } from "@/lib/auth-guard";

const FEE_PCT = 0.02;
const EXPIRY_MS = 30 * 60 * 1000;

export const Route = createFileRoute("/upgrade")({
  beforeLoad: ({ location }) => requireClientUser(location.href),
  component: UpgradePage,
});

function copy(value: string, label = "Copied") {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} to clipboard`),
    () => toast.error("Could not copy"),
  );
}

function Countdown({ createdAt }: { createdAt: string }) {
  const end = new Date(createdAt).getTime() + EXPIRY_MS;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, end - now);
  if (remaining === 0)
    return (
      <Badge variant="destructive" className="gap-1">
        <Clock className="h-3 w-3" /> Expired
      </Badge>
    );
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
    >
      <Clock className="h-3 w-3" /> {m}:{s} left
    </Badge>
  );
}

function UpgradePage() {
  const qc = useQueryClient();
  const mine = useServerFn(getMyPlan);
  const myReqs = useServerFn(listMyUpgradeRequests);
  const packages = useServerFn(listAvailablePackages);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    void getVerifiedClientSession().then((verified) => {
      if (active) setEmail(verified?.user.email ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

  const {
    data: pkgs = [],
    isLoading: packagesLoading,
    error: packagesError,
  } = useQuery({
    queryKey: ["packages-active"],
    queryFn: () => packages(),
  });
  const { data: plan } = useQuery({ queryKey: ["my-plan"], queryFn: () => mine() });
  const { data: requests = [] } = useQuery({
    queryKey: ["my-upgrade-requests"],
    queryFn: () => myReqs(),
    refetchInterval: 15000,
  });

  const [picked, setPicked] = useState<any | null>(null);

  const basePrice = picked
    ? Number(
        picked?.billing_period === "lifetime" || Number(picked?.price_onetime) > 0
          ? picked.price_onetime
          : picked.price_monthly,
      ) || 0
    : 0;
  const feeAmount = Math.round(basePrice * FEE_PCT * 100) / 100;
  const totalAmount = Math.round(basePrice * (1 + FEE_PCT) * 100) / 100;

  const plisioM = useMutation({
    mutationFn: async () => {
      if (!picked) throw new Error("Choose a package first");
      const verified = await getVerifiedClientSession();
      const accessToken = verified?.session.access_token;
      if (!accessToken) throw new Error("Please login again before payment.");

      const response = await fetch("/api/public/plisio-create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ package_slug: picked.slug }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Could not create invoice");
      return result;
    },
    onSuccess: (res: any) => {
      if (res?.invoice_url) {
        toast.success("Redirecting to crypto checkout…");
        window.location.href = res.invoice_url;
      } else {
        toast.error("Could not create invoice");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const visible = pkgs.filter((p: any) => p.is_active);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Rocket className="h-7 w-7 text-primary" /> Upgrade your plan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You're on <Badge variant="outline">{plan?.plan_slug ?? "free"}</Badge> ·{" "}
          {plan?.links_used ?? 0}/{plan?.link_quota ?? 1} links used.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {packagesLoading &&
          ["free", "pro", "lifetime"].map((key) => (
            <Card key={key} className="min-h-72 animate-pulse border-primary/10 bg-card/70" />
          ))}
        {!packagesLoading && packagesError && (
          <Card className="md:col-span-3 border-destructive/30 bg-destructive/10">
            <CardContent className="p-5 text-sm text-destructive">
              Packages could not load. Please refresh or login again.
            </CardContent>
          </Card>
        )}
        {visible.map((p: any) => {
          const isCurrent = plan?.plan_slug === p.slug;
          const isLifetime = p.billing_period === "lifetime" || Number(p.price_onetime) > 0;
          const price = isLifetime ? Number(p.price_onetime) : Number(p.price_monthly);
          const periodLabel = isLifetime ? "one-time" : "/mo";
          const clickLabel =
            p.click_limit == null
              ? "Unlimited clicks"
              : `${Number(p.click_limit).toLocaleString()} clicks${isLifetime ? " — lifetime" : " / month"}`;
          const linkLabel =
            p.link_limit == null || p.link_limit >= 999999
              ? "Unlimited links"
              : `${p.link_limit} links included`;
          const isFree = price === 0 && !isLifetime;
          return (
            <Card
              key={p.id}
              className={`flex flex-col ${isLifetime ? "border-primary shadow-lg" : ""} ${isCurrent ? "ring-2 ring-primary" : ""}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {p.name}
                    {isLifetime && (
                      <Badge
                        variant="default"
                        className="bg-gradient-to-r from-primary to-primary/70"
                      >
                        Best value
                      </Badge>
                    )}
                  </span>
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">${price.toFixed(2)}</span>
                  <span className="text-muted-foreground"> {periodLabel}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-3 space-y-1 rounded-md bg-muted/50 p-3 text-sm">
                  <div className="font-medium">{linkLabel}</div>
                  <div className="text-muted-foreground">{clickLabel}</div>
                </div>
                <ul className="flex-1 space-y-2 text-sm">
                  {(p.features ?? []).map((f: string) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  disabled={isCurrent || isFree}
                  onClick={() => setPicked(p)}
                >
                  {isCurrent
                    ? "Current plan"
                    : isFree
                      ? "Free forever"
                      : isLifetime
                        ? "Get lifetime access"
                        : "Request upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your upgrade requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upgrade requests yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r: any) => {
                const isPlisio = r.payment_method === "plisio";
                const isPending = r.status === "pending" && r.plisio_status !== "completed";
                const ageMs = Date.now() - new Date(r.created_at).getTime();
                const expired = isPlisio && isPending && ageMs > EXPIRY_MS;
                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 font-medium">
                        {r.package_slug} · ${Number(r.amount ?? 0).toFixed(2)}
                        {isPlisio && (
                          <Badge variant="outline" className="gap-1">
                            <Bitcoin className="h-3 w-3" /> Crypto
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                        {r.transaction_ref && (
                          <>
                            {" "}
                            · <code className="rounded bg-muted px-1">{r.transaction_ref}</code>
                            <button
                              type="button"
                              className="ml-1 inline-flex align-middle text-primary"
                              onClick={() => copy(r.transaction_ref, "Order ID")}
                              aria-label="Copy order ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isPlisio && isPending && !expired && <Countdown createdAt={r.created_at} />}
                      {expired && (
                        <Badge variant="destructive" className="gap-1">
                          <Clock className="h-3 w-3" /> Expired
                        </Badge>
                      )}
                      {r.plisio_invoice_url && isPending && !expired && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={r.plisio_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Pay now
                          </a>
                        </Button>
                      )}
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "default"
                            : r.status === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {r.status === "approved" ? "✓ Successful" : r.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          {/* Premium gradient header */}
          <div className="relative bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-6 pb-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-6 w-6 text-primary" /> {picked?.name}
              </DialogTitle>
              <DialogDescription>
                Pay instantly with crypto — your plan activates automatically once confirmed
                on-chain.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 p-6 pt-2">
            {/* Price breakdown */}
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Package price</span>
                <span>${basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network fee (2%)</span>
                <span>${feeAmount.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-end justify-between border-t pt-2">
                <span className="font-medium">You pay</span>
                <span className="text-2xl font-bold text-primary">${totalAmount.toFixed(2)}</span>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Send the exact total above to the wallet shown on Plisio. Underpayment will not
                auto-approve.
              </p>
            </div>

            <Button
              size="lg"
              className="h-12 w-full bg-gradient-to-r from-primary to-primary/80 text-base font-semibold shadow-lg hover:opacity-95"
              onClick={() => plisioM.mutate()}
              disabled={plisioM.isPending}
            >
              <Bitcoin className="mr-2 h-5 w-5" />
              {plisioM.isPending
                ? "Creating invoice…"
                : `Pay $${totalAmount.toFixed(2)} with Crypto`}
            </Button>

            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Invoice expires in 30 minutes · BTC, LTC, USDT,
              USDT-TRC20
            </p>

            <div className="rounded-lg border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              Automatic Plisio checkout only — no manual payment review needed.
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
