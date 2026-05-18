import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Plus, Copy, ExternalLink, LogOut, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: Dashboard,
});

type LinkRow = {
  id: string;
  short_code: string;
  destination_url: string;
  title: string | null;
  clicks_count: number;
  bot_clicks_count: number;
  created_at: string;
};

function genCode() {
  return Math.random().toString(36).slice(2, 8);
}

function Dashboard() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState<string>("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    setEmail(userData.user?.email ?? "");
    const { data, error } = await supabase
      .from("links")
      .select("id, short_code, destination_url, title, clicks_count, bot_clicks_count, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setLinks(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try { new URL(url); } catch { toast.error("Invalid URL"); setCreating(false); return; }
    const { error } = await supabase.from("links").insert({
      user_id: userData.user.id,
      short_code: genCode(),
      destination_url: url,
      title: title || null,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Link created!");
    setUrl(""); setTitle("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(`${baseUrl}/r/${code}`);
    toast.success("Copied!");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const totalClicks = links.reduce((s, l) => s + l.clicks_count, 0);
  const totalBots = links.reduce((s, l) => s + l.bot_clicks_count, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-sidebar">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <Shield className="h-6 w-6 text-primary" /> LinkShield
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">{email}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your short links and track real traffic.</p>

        {/* Stats */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { label: "Total links", value: links.length, icon: Shield },
            { label: "Real clicks", value: totalClicks, icon: BarChart3 },
            { label: "Bots blocked", value: totalBots, icon: Shield },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card-gradient p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-3xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Create link */}
        <div className="mt-8 rounded-2xl border border-border bg-card-gradient p-6">
          <h2 className="font-display text-lg font-semibold">Create new short link</h2>
          <form onSubmit={create} className="mt-4 grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <div>
              <Label htmlFor="url" className="sr-only">Destination URL</Label>
              <Input id="url" placeholder="https://your-offer.com/landing" required value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="title" className="sr-only">Title</Label>
              <Input id="title" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <Button type="submit" disabled={creating} className="gap-2 shadow-glow">
              <Plus className="h-4 w-4" /> {creating ? "Creating..." : "Create"}
            </Button>
          </form>
        </div>

        {/* Links list */}
        <div className="mt-8 rounded-2xl border border-border bg-card-gradient">
          <div className="border-b border-border p-6">
            <h2 className="font-display text-lg font-semibold">Your links</h2>
          </div>
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading...</div>
          ) : links.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No links yet. Create your first one above.</div>
          ) : (
            <div className="divide-y divide-border">
              {links.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-4 p-4 hover:bg-accent/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-secondary px-2 py-0.5 font-mono text-sm text-primary">
                        /r/{l.short_code}
                      </code>
                      {l.title && <span className="text-sm font-medium">{l.title}</span>}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{l.destination_url}</div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Real</div>
                      <div className="font-mono font-semibold text-success">{l.clicks_count}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Bots</div>
                      <div className="font-mono font-semibold text-destructive">{l.bot_clicks_count}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => copy(l.short_code)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a href={`/r/${l.short_code}`} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" title="Open">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => remove(l.id)} className="text-destructive">
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
