import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Link2, Copy, Trash2, Play, Pause, Sparkles, Activity, Shield, Infinity as InfinityIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listMyLinks, createLink, deleteLink, toggleLink, getMyProfile } from "@/lib/links.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sleepox" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyLinks);
  const profile = useServerFn(getMyProfile);
  const create = useServerFn(createLink);
  const remove = useServerFn(deleteLink);
  const toggle = useServerFn(toggleLink);

  const linksQ = useQuery({ queryKey: ["links"], queryFn: () => list() });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => profile() });

  const [adsterra, setAdsterra] = useState("");
  const [safe, setSafe] = useState("");
  const [title, setTitle] = useState("");

  const createMut = useMutation({
    mutationFn: (vars: { title?: string; adsterra_url: string; safe_url?: string }) =>
      create({ data: vars }),
    onSuccess: () => {
      toast.success("Link created");
      setAdsterra(""); setSafe(""); setTitle("");
      qc.invalidateQueries({ queryKey: ["links"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["links"] });
    },
  });

  const togMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links"] }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate({ title: title || undefined, adsterra_url: adsterra, safe_url: safe || undefined });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://sleepox.com";
  const p = profileQ.data;

  const totalHumans = linksQ.data?.reduce((s, l) => s + (l.clicks_count || 0), 0) ?? 0;
  const totalBots = linksQ.data?.reduce((s, l) => s + (l.bot_clicks_count || 0), 0) ?? 0;

  return (
    <div className="space-y-10">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 sky-glow border border-sky/40">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-sky-gradient opacity-20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky/40 px-3 py-1 text-xs">
              <span className="live-dot" /> Live console
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              <span className="text-gradient-sky">Welcome back.</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your cloaked links, monitor traffic quality, and grow earnings.</p>
          </div>
          {p && (
            <div className="rounded-2xl border border-sky/30 bg-card/40 px-5 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</div>
              <div className="mt-0.5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-lg font-bold text-gradient-sky">{p.plan_slug.toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {p && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={<Link2 className="h-5 w-5" />} label="Active links" value={`${p.links_used} / ${p.link_limit ?? "∞"}`} />
          <StatCard icon={<Activity className="h-5 w-5" />} label="Human clicks" value={totalHumans.toLocaleString()} accent />
          <StatCard icon={<Shield className="h-5 w-5" />} label="Bots blocked" value={totalBots.toLocaleString()} />
          <StatCard icon={<InfinityIcon className="h-5 w-5" />} label="Click quota" value={p.click_quota ? p.click_quota.toLocaleString() : "Unlimited"} />
        </div>
      )}

      {/* Create link */}
      <section className="glass-card rounded-2xl p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-gradient sky-glow">
            <Plus className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Create new link</h2>
            <p className="text-xs text-muted-foreground">Paste your Adsterra Direct Link. We&apos;ll wrap it with bot-shield + clean stats.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="t" className="text-xs uppercase tracking-wider text-muted-foreground">Title (optional)</Label>
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My ad campaign" className="mt-1.5 h-11 bg-card/40 border-sky/30" />
          </div>
          <div>
            <Label htmlFor="a" className="text-xs uppercase tracking-wider text-muted-foreground">Adsterra Direct Link *</Label>
            <Input id="a" type="url" required value={adsterra} onChange={(e) => setAdsterra(e.target.value)} placeholder="https://..." className="mt-1.5 h-11 bg-card/40 border-sky/30" />
          </div>
          <div>
            <Label htmlFor="s" className="text-xs uppercase tracking-wider text-muted-foreground">Safe URL (for reviewers)</Label>
            <Input id="s" type="url" value={safe} onChange={(e) => setSafe(e.target.value)} placeholder="https://sleepox.com/" className="mt-1.5 h-11 bg-card/40 border-sky/30" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMut.isPending} className="h-11 px-8 bg-sky-gradient text-primary-foreground sky-glow hover:opacity-90 font-semibold">
              {createMut.isPending ? "Creating..." : "Create link"}
            </Button>
          </div>
        </form>
      </section>

      {/* Links */}
      <section>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Your links</h2>
            <p className="text-xs text-muted-foreground">{linksQ.data?.length ?? 0} total · live traffic stats</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {linksQ.isLoading && (
            <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">Loading links…</div>
          )}
          {linksQ.data?.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <Link2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No links yet. Create your first cloaked link above.</p>
            </div>
          )}
          {linksQ.data?.map((l) => {
            const shortUrl = `${origin}/r/${l.short_code}`;
            return (
              <div key={l.id} className="glass-card group rounded-2xl p-5 transition hover:sky-glow hover:border-sky">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${l.is_active ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
                      <h3 className="font-semibold truncate">{l.title || l.short_code}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="rounded-md bg-background/60 px-3 py-1.5 text-xs font-mono text-primary border border-sky/30">{shortUrl}</code>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <div className="mt-2 truncate text-xs text-muted-foreground">→ {l.adsterra_url}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-success" />
                        <span className="font-semibold text-success">{(l.clicks_count || 0).toLocaleString()}</span>
                        <span className="text-muted-foreground">humans</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-warning" />
                        <span className="font-semibold text-warning">{(l.bot_clicks_count || 0).toLocaleString()}</span>
                        <span className="text-muted-foreground">bots blocked</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={l.is_active ? "default" : "outline"}
                      onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                      className={l.is_active ? "bg-sky-gradient text-primary-foreground" : "border-sky/40"}
                    >
                      {l.is_active ? <><Play className="h-3.5 w-3.5 mr-1" /> Active</> : <><Pause className="h-3.5 w-3.5 mr-1" /> Paused</>}
                    </Button>
                    <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => {
                      if (confirm("Delete this link?")) delMut.mutate(l.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`glass-card rounded-2xl p-5 transition hover:sky-glow ${accent ? "border-sky/50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ? "bg-sky-gradient text-primary-foreground" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
      </div>
      <div className={`mt-2 text-2xl font-bold ${accent ? "text-gradient-sky" : ""}`}>{value}</div>
    </div>
  );
}
