import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Globe2,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSidebar } from "@/components/app-sidebar";
import { supabase } from "@/integrations/supabase/client";
import {
  addCustomDomain,
  deleteCustomDomain,
  listCustomDomains,
  verifyCustomDomain,
} from "@/lib/domain.functions";

export const Route = createFileRoute("/domains")({
  head: () => ({
    meta: [
      { title: "Custom Domains — LinkShield" },
      { name: "description", content: "Connect your own domain to LinkShield short links for branded, trustworthy URLs in every ad campaign." },
      { property: "og:title", content: "Custom Domains — LinkShield" },
      { property: "og:description", content: "Branded short links on your own domain — verified with one click." },
      { property: "og:url", content: "https://sleepox.com/domains" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sleepox.com/domains" }],
  }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: DomainsPage,
});

type DomainRow = Awaited<ReturnType<typeof listCustomDomains>>[number];

const statusMeta = {
  action_required: {
    label: "Action required",
    icon: TriangleAlert,
    className: "text-warning bg-warning/10",
  },
  verifying: { label: "Verifying", icon: Clock3, className: "text-primary bg-primary/10" },
  setting_up: { label: "Setting up", icon: RefreshCw, className: "text-primary bg-primary/10" },
  ready: { label: "Ready", icon: CheckCircle2, className: "text-success bg-success/10" },
  active: { label: "Active", icon: CheckCircle2, className: "text-success bg-success/10" },
  offline: {
    label: "Offline",
    icon: TriangleAlert,
    className: "text-destructive bg-destructive/10",
  },
  failed: { label: "Failed", icon: TriangleAlert, className: "text-destructive bg-destructive/10" },
} as const;

function DomainsPage() {
  const fetchDomains = useServerFn(listCustomDomains);
  const createDomain = useServerFn(addCustomDomain);
  const checkDomain = useServerFn(verifyCustomDomain);
  const removeDomain = useServerFn(deleteCustomDomain);
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    setEmail(data.session?.user.email ?? "");
    try {
      setDomains(await fetchDomains());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load domains");
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const clean = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    try {
      await createDomain({ data: { domain: clean } });
      toast.success("Domain added");
      setDomain("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add domain");
    }
  };

  const verify = async (id: string) => {
    setBusyId(id);
    try {
      const result = await checkDomain({ data: { id } });
      toast.success(result.status === "ready" ? "DNS verified" : "DNS records still pending");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    }
    setBusyId(null);
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await removeDomain({ data: { id } });
      toast.success("Domain removed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove domain");
    }
    setBusyId(null);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar email={email} />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/40 bg-background/80 px-6 backdrop-blur-xl">
            <SidebarTrigger className="-ml-2" />
            <div className="h-5 w-px bg-border" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Workspace</span> / Domains
            </div>
          </header>

          <main className="flex-1 px-6 py-6 lg:px-10 space-y-6">
            <section className="relative overflow-hidden border border-border bg-card-gradient p-6 shadow-card rounded-2xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Globe2 className="h-4 w-4" /> Custom domains
                  </div>
                  <h1 className="mt-2 font-display text-3xl font-bold">
                    Connect branded short-link domains.
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Add your root domain, copy the DNS records, then run verification to see live
                    setup status.
                  </p>
                </div>
                <form
                  onSubmit={add}
                  className="grid w-full gap-2 sm:grid-cols-[1fr_auto] lg:max-w-lg"
                >
                  <Label htmlFor="domain" className="sr-only">
                    Domain
                  </Label>
                  <Input
                    id="domain"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourdomain.com"
                  />
                  <Button type="submit" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Add domain
                  </Button>
                </form>
              </div>
            </section>

            <section className="grid gap-4">
              {loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-secondary/60" />
              ) : domains.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  No domains added yet.
                </div>
              ) : (
                domains.map((d) => (
                  <DomainCard
                    key={d.id}
                    domain={d}
                    busy={busyId === d.id}
                    onVerify={() => verify(d.id)}
                    onRemove={() => remove(d.id)}
                  />
                ))
              )}
            </section>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function DomainCard({
  domain,
  busy,
  onVerify,
  onRemove,
}: {
  domain: DomainRow;
  busy: boolean;
  onVerify: () => void;
  onRemove: () => void;
}) {
  const meta = statusMeta[domain.status];
  const Icon = meta.icon;
  const txtName = `_lovable.${domain.domain}`;
  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied");
  };
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card-gradient shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">{domain.domain}</h2>
          <p className="text-xs text-muted-foreground">
            Last checked:{" "}
            {domain.last_checked_at ? new Date(domain.last_checked_at).toLocaleString() : "Never"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
          >
            <Icon className="h-3.5 w-3.5" /> {meta.label}
          </span>
          <Button variant="outline" size="sm" disabled={busy} onClick={onVerify}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Verify
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
            aria-label={`Remove domain ${domain.domain}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 p-5 lg:grid-cols-3">
        <DnsRow label="Root A record" type="A" name="@" value={domain.dns_target} onCopy={copy} />
        <DnsRow label="WWW A record" type="A" name="www" value={domain.dns_target} onCopy={copy} />
        <DnsRow
          label="Verification TXT"
          type="TXT"
          name={txtName}
          value={domain.verification_token}
          onCopy={copy}
        />
      </div>
    </article>
  );
}

function DnsRow({
  label,
  type,
  name,
  value,
  onCopy,
}: {
  label: string;
  type: string;
  name: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/45 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-3 grid grid-cols-[56px_1fr_auto] items-center gap-2 text-sm">
        <span className="rounded-md bg-primary/10 px-2 py-1 text-center font-mono text-xs font-bold text-primary">
          {type}
        </span>
        <div className="min-w-0">
          <div className="truncate font-mono text-xs">{name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{value}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopy(value)} aria-label={`Copy ${label}`}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
