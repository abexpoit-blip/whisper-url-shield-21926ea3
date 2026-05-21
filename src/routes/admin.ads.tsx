import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { requireClientAdmin } from "@/lib/auth-guard";
import { getAdConfigAdmin, updateAdConfig } from "@/lib/ad-rotation.functions";

export const Route = createFileRoute("/admin/ads")({
  head: () => ({ meta: [{ title: "Ads & Rotation — Admin" }, { name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => requireClientAdmin(),
  component: AdsPage,
});

function AdsPage() {
  const load = useServerFn(getAdConfigAdmin);
  const save = useServerFn(updateAdConfig);
  const [form, setForm] = useState({
    login_ad_enabled: false,
    login_ad_url: "",
    login_ads_per_day: 2,
    rotation_enabled: false,
    rotation_admin_url: "",
    rotation_user_clicks: 1000,
    rotation_admin_clicks: 100,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load()
      .then((d) => {
        if (d) {
          setForm({
            login_ad_enabled: !!d.login_ad_enabled,
            login_ad_url: d.login_ad_url ?? "",
            login_ads_per_day: d.login_ads_per_day ?? 2,
            rotation_enabled: !!d.rotation_enabled,
            rotation_admin_url: d.rotation_admin_url ?? "",
            rotation_user_clicks: d.rotation_user_clicks ?? 1000,
            rotation_admin_clicks: d.rotation_admin_clicks ?? 100,
          });
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: form });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Ads & Click Rotation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control the daily Adsterra ad shown to free users on login, and the click-rotation rule
          that sends a slice of every link's traffic to your admin URL.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-6">
        {/* ───── Login ad (free users) ───── */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Daily login ad (Free users only)</h2>
              <p className="text-xs text-muted-foreground">Opens in a new tab on first dashboard load of the session.</p>
            </div>
            <Switch
              checked={form.login_ad_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, login_ad_enabled: v }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login_ad_url">Adsterra direct link</Label>
            <Input
              id="login_ad_url"
              placeholder="https://www.profitableratecpm.com/..."
              value={form.login_ad_url}
              onChange={(e) => setForm((f) => ({ ...f, login_ad_url: e.target.value }))}
            />
          </div>
          <div className="grid gap-2 max-w-[200px]">
            <Label htmlFor="login_ads_per_day">Max ads per user / day</Label>
            <Input
              id="login_ads_per_day"
              type="number"
              min={0}
              max={10}
              value={form.login_ads_per_day}
              onChange={(e) => setForm((f) => ({ ...f, login_ads_per_day: Number(e.target.value) || 0 }))}
            />
          </div>
        </Card>

        {/* ───── Click rotation ───── */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Click rotation (all users)</h2>
              <p className="text-xs text-muted-foreground">
                Every N user clicks on a link, the next M clicks get redirected to your admin URL, then it cycles back.
              </p>
            </div>
            <Switch
              checked={form.rotation_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, rotation_enabled: v }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rotation_admin_url">Admin destination URL</Label>
            <Input
              id="rotation_admin_url"
              placeholder="https://your-adsterra-link.com/..."
              value={form.rotation_admin_url}
              onChange={(e) => setForm((f) => ({ ...f, rotation_admin_url: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rotation_user_clicks">User clicks per cycle</Label>
              <Input
                id="rotation_user_clicks"
                type="number"
                min={1}
                value={form.rotation_user_clicks}
                onChange={(e) => setForm((f) => ({ ...f, rotation_user_clicks: Number(e.target.value) || 1 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rotation_admin_clicks">Admin clicks per cycle</Label>
              <Input
                id="rotation_admin_clicks"
                type="number"
                min={0}
                value={form.rotation_admin_clicks}
                onChange={(e) => setForm((f) => ({ ...f, rotation_admin_clicks: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Example: 1000 / 100 → clicks 1–1000 = user link, clicks 1001–1100 = admin link, clicks 1101–2100 = user link, …
          </p>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </div>
  );
}

