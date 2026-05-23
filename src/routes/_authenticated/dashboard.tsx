import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
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

  return (
    <div className="space-y-8">
      {p && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Plan" value={p.plan_slug.toUpperCase()} />
          <Stat label="Links" value={`${p.links_used} / ${p.link_limit}`} />
          <Stat label="Clicks used" value={p.clicks_used.toLocaleString()} />
          <Stat label="Click quota" value={p.click_quota ? p.click_quota.toLocaleString() : "Unlimited"} />
        </div>
      )}

      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Create new link</h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="t">Title (optional)</Label>
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My ad campaign" />
          </div>
          <div>
            <Label htmlFor="a">Adsterra Direct Link *</Label>
            <Input id="a" type="url" required value={adsterra} onChange={(e) => setAdsterra(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="s">Safe URL (for reviewers)</Label>
            <Input id="s" type="url" value={safe} onChange={(e) => setSafe(e.target.value)} placeholder="https://sleepox.com/" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Creating..." : "Create link"}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Your links</h2>
        <div className="mt-4 space-y-3">
          {linksQ.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {linksQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No links yet.</p>}
          {linksQ.data?.map((l) => {
            const shortUrl = `${origin}/r/${l.short_code}`;
            return (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{l.title || l.short_code}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <code className="rounded bg-muted px-2 py-0.5">{shortUrl}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(shortUrl);
                        toast.success("Copied");
                      }}
                      className="text-primary hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">→ {l.adsterra_url}</div>
                  <div className="mt-1 text-xs">
                    <span className="text-green-600">{l.clicks_count} humans</span>
                    {" · "}
                    <span className="text-orange-600">{l.bot_clicks_count} bots blocked</span>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={l.is_active ? "default" : "outline"}
                    onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                  >
                    {l.is_active ? "Active" : "Paused"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (confirm("Delete this link?")) delMut.mutate(l.id);
                  }}>
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
