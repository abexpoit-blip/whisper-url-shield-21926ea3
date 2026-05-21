/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  Infinity as InfinityIcon,
  Zap,
  Crown,
  MousePointerClick,
  Link2,
} from "lucide-react";
import {
  createPlisioInvoice,
  getMyPlan,
  listMyUpgradeRequests,
  listAvailablePackages,
} from "@/lib/billing.functions";
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
  const mine = useServerFn(getMyPlan);
  const myReqs = useServerFn(listMyUpgradeRequests);
  const packages = useServerFn(listAvailablePackages);
  const createInvoice = useServerFn(createPlisioInvoice);
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
      if (!verified) throw new Error("Please login again before payment.");
      return createInvoice({ data: { package_slug: picked.slug } });
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar email={email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/40 bg-background/80 px-6 backdrop-blur-xl">
            <SidebarTrigger className="-ml-2" />
            <div className="hidden h-5 w-px bg-border md:block" />
            <div className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
              <span className="font-medium text-foreground">Workspace</span>
              <span>/</span>
              <span>Upgrade</span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl space-y-10 p-6">
            <div className="text-center">
              <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary">
                <Sparkles className="mr-1 h-3 w-3" /> Choose your plan
              </Badge>
              <h1 className="flex items-center justify-center gap-2 text-3xl font-bold md:text-4xl">
                <Rocket className="h-8 w-8 text-primary" /> Upgrade your plan
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You're on <Badge variant="outline">{plan?.plan_slug ?? "free"}</Badge> ·{" "}
                {plan?.links_used ?? 0}/{plan?.link_quota ?? 1} links used. All paid plans charged
                in crypto with a 2% network fee.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {packagesLoading &&
                ["free", "pro", "lifetime"].map((key) => (
                  <Card key={key} className="min-h-[28rem] animate-pulse border-primary/10 bg-card/70" />
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
                const periodLabel = isLifetime ? "one-time · forever" : "per month";
                const unlimitedClicks = p.click_limit == null;
                const unlimitedLinks = p.link_limit == null || p.link_limit >= 999999;
                const clickLabel = unlimitedClicks
                  ? "Unlimited clicks"
                  : `${Number(p.click_limit).toLocaleString()} clicks${isLifetime ? " — lifetime" : " / month"}`;
                const linkLabel = unlimitedLinks
                  ? "Unlimited links"
                  : `${p.link_limit} link${p.link_limit > 1 ? "s" : ""} included`;
                const isFree = price === 0 && !isLifetime;
                const tagline = isLifetime
                  ? "All premium features unlocked forever. One payment, zero renewals."
                  : isFree
                    ? "Start free, test cloaking, and explore every core feature."
                    : "For active media buyers running Meta, TikTok & Google ads at scale.";
                const Icon = isLifetime ? Crown : isFree ? Zap : Rocket;
                const total = (price * 1.02).toFixed(2);

                return (
                  <Card
                    key={p.id}
                    className={`relative flex flex-col overflow-hidden transition-all hover:shadow-xl ${
                      isLifetime
                        ? "border-primary/60 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg shadow-primary/20"
                        : "border-border/60"
                    } ${isCurrent ? "ring-2 ring-primary" : ""}`}
                  >
                    {isLifetime && (
                      <div className="absolute right-3 top-3">
                        <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md">
                          <Crown className="mr-1 h-3 w-3" /> Best value
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div
                        className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                          isLifetime
                            ? "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground"
                            : isFree
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="flex items-center justify-between text-xl">
                        <span>{p.name}</span>
                        {isCurrent && <Badge variant="secondary">Current</Badge>}
                      </CardTitle>
                      <CardDescription className="min-h-[2.5rem] text-sm">{tagline}</CardDescription>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-4xl font-bold tracking-tight text-foreground">
                          ${price.toFixed(0)}
                        </span>
                        <span className="text-sm text-muted-foreground">/{isLifetime ? "lifetime" : "mo"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{periodLabel}</div>
                      {!isFree && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          ≈ <span className="font-medium text-foreground">${total}</span> total (incl. 2% network fee)
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col">
                      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 text-primary" />
                          <div>
                            <div className="font-semibold text-foreground">
                              {unlimitedLinks ? (
                                <span className="flex items-center gap-0.5">
                                  <InfinityIcon className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                p.link_limit
                              )}
                            </div>
                            <div className="text-muted-foreground">{unlimitedLinks ? "links" : p.link_limit === 1 ? "link" : "links"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MousePointerClick className="h-3.5 w-3.5 text-primary" />
                          <div>
                            <div className="font-semibold text-foreground">
                              {unlimitedClicks ? (
                                <InfinityIcon className="h-3.5 w-3.5" />
                              ) : Number(p.click_limit) >= 1000000 ? (
                                `${(Number(p.click_limit) / 1000000).toFixed(0)}M`
                              ) : (
                                `${(Number(p.click_limit) / 1000).toFixed(0)}K`
                              )}
                            </div>
                            <div className="text-muted-foreground">{isLifetime ? "clicks · ever" : "clicks/mo"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        What's included
                      </div>
                      <ul className="flex-1 space-y-2 text-sm">
                        {(p.features ?? []).map((f: string) => (
                          <li key={f} className="flex items-start gap-2">
                            <div
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                                isLifetime ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                              }`}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            <span className="text-foreground/90">{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="lg"
                        className={`mt-6 w-full font-semibold ${
                          isLifetime
                            ? "bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:opacity-95"
                            : ""
                        }`}
                        variant={isLifetime ? "default" : isFree ? "outline" : "default"}
                        disabled={isCurrent || isFree}
                        onClick={() => setPicked(p)}
                      >
                        {isCurrent
                          ? "Current plan"
                          : isFree
                            ? "Free forever"
                            : isLifetime
                              ? "Get lifetime access"
                              : "Upgrade with crypto"}
                      </Button>
                      {!isFree && !isCurrent && (
                        <p className="mt-2 text-center text-[11px] text-muted-foreground">
                          Instant activation after on-chain confirmation
                        </p>
                      )}
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
                                  ·{" "}
                                  <code className="rounded bg-muted px-1">{r.transaction_ref}</code>
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
                            {isPlisio && isPending && !expired && (
                              <Countdown createdAt={r.created_at} />
                            )}
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
                      <span className="text-2xl font-bold text-primary">
                        ${totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Send the exact total above to the wallet shown on Plisio. Underpayment will
                      not auto-approve.
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
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
