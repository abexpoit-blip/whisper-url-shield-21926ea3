import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/links/$linkId/settings")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: LinkSettingsPage,
});

type Targeting = {
  allowed_countries?: string[];
  blocked_countries?: string[];
  allowed_devices?: string[];
  blocked_devices?: string[];
  allowed_languages?: string[];
  blocked_languages?: string[];
  allowed_hours?: { start: number; end: number } | null;
};

type Dest = {
  id: string;
  url: string;
  label: string | null;
  weight: number;
  is_active: boolean;
};

const DEVICES = ["desktop", "mobile", "tablet"];

function parseList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function LinkSettingsPage() {
  const { linkId } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<{
    short_code: string;
    title: string | null;
    destination_url: string;
    adsterra_direct_link: string | null;
  } | null>(null);
  const [adsterraInput, setAdsterraInput] = useState("");
  const [savingAdsterra, setSavingAdsterra] = useState(false);
  const [t, setT] = useState<Targeting>({});
  const [allowedCountries, setAllowedCountries] = useState("");
  const [blockedCountries, setBlockedCountries] = useState("");
  const [allowedLangs, setAllowedLangs] = useState("");
  const [blockedLangs, setBlockedLangs] = useState("");
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [hourStart, setHourStart] = useState(0);
  const [hourEnd, setHourEnd] = useState(23);
  const [dests, setDests] = useState<Dest[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newWeight, setNewWeight] = useState(1);

  const load = async () => {
    setLoading(true);
    const { data: linkRow, error: e1 } = await supabase
      .from("links")
      .select("short_code,title,destination_url,adsterra_direct_link,targeting")
      .eq("id", linkId)
      .maybeSingle();
    if (e1 || !linkRow) {
      toast.error("Link not found");
      navigate({ to: "/dashboard" });
      return;
    }
    setLink({
      short_code: linkRow.short_code,
      title: linkRow.title,
      destination_url: linkRow.destination_url,
      adsterra_direct_link: linkRow.adsterra_direct_link,
    });
    setAdsterraInput(linkRow.adsterra_direct_link ?? "");
    const tg = (linkRow.targeting ?? {}) as Targeting;
    setT(tg);
    setAllowedCountries((tg.allowed_countries ?? []).join(", "));
    setBlockedCountries((tg.blocked_countries ?? []).join(", "));
    setAllowedLangs((tg.allowed_languages ?? []).join(", "));
    setBlockedLangs((tg.blocked_languages ?? []).join(", "));
    if (tg.allowed_hours) {
      setHoursEnabled(true);
      setHourStart(tg.allowed_hours.start);
      setHourEnd(tg.allowed_hours.end);
    }

    const { data: dRows } = await supabase
      .from("link_destinations")
      .select("id,url,label,weight,is_active")
      .eq("link_id", linkId)
      .order("created_at", { ascending: true });
    setDests((dRows ?? []) as Dest[]);
    setLoading(false);
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [linkId]);

  const toggleDevice = (d: string, list: "allowed_devices" | "blocked_devices") => {
    setT((prev) => {
      const cur = new Set(prev[list] ?? []);
      if (cur.has(d)) cur.delete(d);
      else cur.add(d);
      return { ...prev, [list]: Array.from(cur) };
    });
  };

  const save = async () => {
    setSaving(true);
    const next: Targeting = {
      allowed_countries: parseList(allowedCountries).map((s) => s.toUpperCase()),
      blocked_countries: parseList(blockedCountries).map((s) => s.toUpperCase()),
      allowed_devices: t.allowed_devices ?? [],
      blocked_devices: t.blocked_devices ?? [],
      allowed_languages: parseList(allowedLangs).map((s) => s.toLowerCase()),
      blocked_languages: parseList(blockedLangs).map((s) => s.toLowerCase()),
      allowed_hours: hoursEnabled
        ? { start: Math.max(0, Math.min(23, hourStart)), end: Math.max(0, Math.min(23, hourEnd)) }
        : null,
    };
    const { error } = await supabase
      .from("links")
      .update({ targeting: next as never })
      .eq("id", linkId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Targeting rules saved");
    void load();
  };
  const saveAdsterra = async () => {
    const trimmed = adsterraInput.trim();
    if (trimmed) {
      try { new URL(trimmed); }
      catch { return toast.error("Invalid Adsterra URL"); }
    }
    setSavingAdsterra(true);
    const { error } = await supabase
      .from("links")
      .update({ adsterra_direct_link: trimmed || null })
      .eq("id", linkId);
    setSavingAdsterra(false);
    if (error) return toast.error(error.message);
    toast.success("Adsterra link saved");
    void load();
  };


  const addDest = async () => {
    try {
      new URL(newUrl);
    } catch {
      toast.error("Invalid URL");
      return;
    }
    const { error } = await supabase.from("link_destinations").insert({
      link_id: linkId,
      url: newUrl,
      label: newLabel || null,
      weight: Math.max(1, Math.min(1000, newWeight)),
      is_active: true,
    });
    if (error) return toast.error(error.message);
    setNewUrl("");
    setNewLabel("");
    setNewWeight(1);
    toast.success("Destination added");
    void load();
  };

  const updateDest = async (d: Dest, patch: Partial<Dest>) => {
    const { error } = await supabase.from("link_destinations").update(patch).eq("id", d.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const removeDest = async (id: string) => {
    const { error } = await supabase.from("link_destinations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const totalWeight = dests
    .filter((d) => d.is_active && d.weight > 0)
    .reduce((s, d) => s + d.weight, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-sidebar">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 font-display font-bold">
            <Shield className="h-5 w-5 text-primary" /> Link Settings
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">/r/{link?.short_code}</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{link?.destination_url}</p>
        </div>

        {/* Adsterra Direct Link */}
        <section className="rounded-2xl border border-border bg-card-gradient p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Adsterra Direct Link</h2>
            <p className="text-sm text-muted-foreground">
              যদি সেট করা থাকে, real visitors (bot check পার করার পর) এই Adsterra URL-এ যাবে। খালি রাখলে উপরের destination URL ব্যবহার হবে।
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://otieu.com/4/xxxxxxx"
              value={adsterraInput}
              onChange={(e) => setAdsterraInput(e.target.value)}
            />
            <Button onClick={saveAdsterra} disabled={savingAdsterra}>
              {savingAdsterra ? "Saving..." : "Save"}
            </Button>
          </div>
        </section>


        {/* Targeting */}
        <section className="rounded-2xl border border-border bg-card-gradient p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Targeting rules</h2>
            <p className="text-sm text-muted-foreground">
              Block or allow visitors by country, device, language, or time. Blocked visitors see a
              safe page.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Allowed countries (ISO codes, comma-separated)</Label>
              <Input
                placeholder="US, GB, BD"
                value={allowedCountries}
                onChange={(e) => setAllowedCountries(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Empty = allow all.</p>
            </div>
            <div>
              <Label>Blocked countries</Label>
              <Input
                placeholder="RU, CN"
                value={blockedCountries}
                onChange={(e) => setBlockedCountries(e.target.value)}
              />
            </div>
            <div>
              <Label>Allowed languages</Label>
              <Input
                placeholder="en, bn"
                value={allowedLangs}
                onChange={(e) => setAllowedLangs(e.target.value)}
              />
            </div>
            <div>
              <Label>Blocked languages</Label>
              <Input
                placeholder="ru, zh"
                value={blockedLangs}
                onChange={(e) => setBlockedLangs(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-2 block">Allowed devices</Label>
              <div className="flex flex-wrap gap-2">
                {DEVICES.map((d) => {
                  const on = t.allowed_devices?.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDevice(d, "allowed_devices")}
                      className={`rounded-full border px-3 py-1 text-xs capitalize ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Empty = allow all.</p>
            </div>
            <div>
              <Label className="mb-2 block">Blocked devices</Label>
              <div className="flex flex-wrap gap-2">
                {DEVICES.map((d) => {
                  const on = t.blocked_devices?.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDevice(d, "blocked_devices")}
                      className={`rounded-full border px-3 py-1 text-xs capitalize ${on ? "bg-destructive text-destructive-foreground border-destructive" : "border-border text-muted-foreground"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={hoursEnabled}
                onChange={(e) => setHoursEnabled(e.target.checked)}
              />
              Restrict to UTC hour window
            </label>
            {hoursEnabled && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Start hour (0-23 UTC)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={hourStart}
                    onChange={(e) => setHourStart(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>End hour (0-23 UTC)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={hourEnd}
                    onChange={(e) => setHourEnd(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}
          </div>

          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save targeting"}
          </Button>
        </section>

        {/* Rotator */}
        <section className="rounded-2xl border border-border bg-card-gradient p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Smart link rotator (A/B/n split)</h2>
            <p className="text-sm text-muted-foreground">
              Add multiple destinations to weight-split traffic. If none are active, the link's
              default destination is used.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_180px_100px_auto]">
            <Input
              placeholder="https://offer-a.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <Input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <Input
              type="number"
              min={1}
              max={1000}
              placeholder="Weight"
              value={newWeight}
              onChange={(e) => setNewWeight(parseInt(e.target.value) || 1)}
            />
            <Button onClick={addDest} className="gap-2">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {dests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rotator destinations yet — link uses default destination.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {dests.map((d) => {
                const pct =
                  totalWeight > 0 && d.is_active && d.weight > 0
                    ? ((d.weight / totalWeight) * 100).toFixed(1)
                    : "0";
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{d.url}</div>
                      {d.label && <div className="text-xs text-muted-foreground">{d.label}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Weight</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        className="w-20"
                        defaultValue={d.weight}
                        onBlur={(e) => {
                          const w = parseInt(e.target.value) || 1;
                          if (w !== d.weight) void updateDest(d, { weight: w });
                        }}
                      />
                      <span className="w-12 text-right text-xs text-muted-foreground">{pct}%</span>
                    </div>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={d.is_active}
                        onChange={(e) => void updateDest(d, { is_active: e.target.checked })}
                      />
                      Active
                    </label>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeDest(d.id)}
                      className="text-destructive"
                      aria-label="Delete destination"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
