import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, Shield, Upload, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/links/$linkId/settings")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
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
  } | null>(null);
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
  // Branding
  const [brandName, setBrandName] = useState("");
  const [brandTagline, setBrandTagline] = useState("");
  const [brandColor, setBrandColor] = useState("#0ea5e9");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data: linkRow, error: e1 } = await supabase
      .from("links")
      .select("short_code,title,destination_url,targeting,brand_logo_url,brand_name,brand_tagline,brand_color")
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
    });
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
    setBrandName(linkRow.brand_name ?? "");
    setBrandTagline(linkRow.brand_tagline ?? "");
    setBrandColor(linkRow.brand_color ?? "#0ea5e9");
    setBrandLogoUrl(linkRow.brand_logo_url ?? null);

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

  const onLogoFileChosen = async (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB");
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      toast.error("Not signed in");
      return;
    }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/${linkId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("link-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingLogo(false);
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("link-logos").getPublicUrl(path);
    setBrandLogoUrl(pub.publicUrl);
    setUploadingLogo(false);
    toast.success("Logo uploaded — don't forget to Save branding");
  };

  const saveBrand = async () => {
    setSavingBrand(true);
    const { error } = await supabase
      .from("links")
      .update({
        brand_name: brandName.trim() || null,
        brand_tagline: brandTagline.trim() || null,
        brand_color: brandColor || null,
        brand_logo_url: brandLogoUrl,
      })
      .eq("id", linkId);
    setSavingBrand(false);
    if (error) return toast.error(error.message);
    toast.success("Branding saved");
    void load();
  };

  const removeLogo = () => {
    setBrandLogoUrl(null);
    toast.message("Logo cleared — click Save branding to apply");
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

        {/* Adsterra Direct Link section removed — destination URL above IS the Adsterra link.
            Bots automatically see the prelander; real users go straight to the destination. */}

        {/* Branding — per-link logo, name, color, tagline */}
        <section className="rounded-2xl border border-border bg-card-gradient p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-sky" /> Prelander branding
              </h2>
              <p className="text-sm text-muted-foreground">
                What bots and ad-review crawlers see on this link. Custom logo + name makes the prelander look like a real publisher site instead of a generic redirect.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[160px_1fr]">
            {/* Logo upload */}
            <div className="space-y-2">
              <Label>Brand logo</Label>
              <div
                className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-background"
                style={brandLogoUrl ? undefined : { borderColor: brandColor + "60" }}
              >
                {brandLogoUrl ? (
                  <img src={brandLogoUrl} alt="Brand logo" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => void onLogoFileChosen(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingLogo ? "Uploading…" : brandLogoUrl ? "Replace" : "Upload"}
                </Button>
                {brandLogoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs text-destructive"
                    onClick={removeLogo}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP, SVG · max 2 MB</p>
            </div>

            {/* Fields */}
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="brand-name">Brand name</Label>
                  <Input
                    id="brand-name"
                    placeholder="Daily Reads"
                    maxLength={80}
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Shown in header & footer. Blank = default.</p>
                </div>
                <div>
                  <Label htmlFor="brand-color">Accent color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="brand-color"
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
                    />
                    <Input
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      placeholder="#0ea5e9"
                      maxLength={9}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="brand-tagline">Tagline</Label>
                <Input
                  id="brand-tagline"
                  placeholder="Wellness & lifestyle articles for everyday readers."
                  maxLength={160}
                  value={brandTagline}
                  onChange={(e) => setBrandTagline(e.target.value)}
                />
              </div>

              {/* Live preview chip */}
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Live preview
                </p>
                <div className="flex items-center gap-3">
                  {brandLogoUrl ? (
                    <img src={brandLogoUrl} alt="" className="h-10 w-10 rounded-lg border border-border object-cover" />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold"
                      style={{ background: brandColor }}
                    >
                      {(brandName || "DR").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="leading-tight">
                    <div className="text-base font-bold" style={{ color: brandColor }}>
                      {brandName || "Daily Reads"}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">
                      {brandTagline || "Wellness & lifestyle articles for everyday readers."}
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={saveBrand} disabled={savingBrand} className="gap-2 self-start">
                <Save className="h-4 w-4" /> {savingBrand ? "Saving…" : "Save branding"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-sky/20 bg-sky-soft/40 p-3 text-xs text-primary/80">
            <p className="font-semibold">Country / device-aware templates</p>
            <p className="mt-1">
              Prelander article templates auto-match the visitor's country and device when admin creates targeted variants. No setup needed per link — your branding wraps every template.
            </p>
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
